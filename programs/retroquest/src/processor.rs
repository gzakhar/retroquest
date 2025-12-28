use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::{clock::Clock, Sysvar},
};

use crate::{
    error::RetroError,
    instructions::RetroInstruction,
    state::*,
};

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = RetroInstruction::unpack(instruction_data)?;

    match instruction {
        RetroInstruction::InitTeamRegistry => {
            process_init_team_registry(program_id, accounts)
        }
        RetroInstruction::CreateSession {
            categories,
            allowlist,
            voting_credits_per_participant,
        } => process_create_session(
            program_id,
            accounts,
            categories,
            allowlist,
            voting_credits_per_participant,
        ),
        RetroInstruction::AdvanceStage { new_stage } => {
            process_advance_stage(program_id, accounts, new_stage)
        }
        RetroInstruction::CloseSession => {
            process_close_session(program_id, accounts)
        }
        RetroInstruction::CreateNote { category_id, content } => {
            process_create_note(program_id, accounts, category_id, content)
        }
        RetroInstruction::CreateGroup { title } => {
            process_create_group(program_id, accounts, title)
        }
        RetroInstruction::SetGroupTitle { group_id, title } => {
            process_set_group_title(program_id, accounts, group_id, title)
        }
        RetroInstruction::AssignNoteToGroup { note_id, group_id } => {
            process_assign_note_to_group(program_id, accounts, note_id, group_id)
        }
        RetroInstruction::UnassignNote { note_id } => {
            process_unassign_note(program_id, accounts, note_id)
        }
        RetroInstruction::CastVote { group_id, credits_delta } => {
            process_cast_vote(program_id, accounts, group_id, credits_delta)
        }
    }
}

fn process_init_team_registry(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    msg!("Instruction: InitTeamRegistry");
    let account_info_iter = &mut accounts.iter();

    let team_registry_info = next_account_info(account_info_iter)?;
    let team_authority_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    if !team_authority_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let (pda, bump) = Pubkey::find_program_address(
        &[TEAM_REGISTRY_SEED, team_authority_info.key.as_ref()],
        program_id,
    );

    if pda != *team_registry_info.key {
        return Err(RetroError::InvalidPDA.into());
    }

    let rent = Rent::get()?;
    let space = TeamRegistry::LEN;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            team_authority_info.key,
            team_registry_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            team_authority_info.clone(),
            team_registry_info.clone(),
            system_program_info.clone(),
        ],
        &[&[TEAM_REGISTRY_SEED, team_authority_info.key.as_ref(), &[bump]]],
    )?;

    let team_registry = TeamRegistry {
        is_initialized: true,
        team_authority: *team_authority_info.key,
        session_count: 0,
        bump,
    };

    team_registry.serialize(&mut *team_registry_info.data.borrow_mut())?;

    Ok(())
}

fn process_create_session(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    categories: Vec<String>,
    allowlist: Vec<Pubkey>,
    voting_credits_per_participant: Option<u8>,
) -> ProgramResult {
    msg!("Instruction: CreateSession");
    let account_info_iter = &mut accounts.iter();

    let team_registry_info = next_account_info(account_info_iter)?;
    let session_info = next_account_info(account_info_iter)?;
    let team_authority_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    if !team_authority_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate categories
    if categories.is_empty() {
        return Err(RetroError::NoCategoriesSpecified.into());
    }
    if categories.len() > MAX_CATEGORIES {
        return Err(RetroError::TooManyCategories.into());
    }
    for category in &categories {
        if category.len() > MAX_CATEGORY_NAME_LEN {
            return Err(RetroError::CategoryNameTooLong.into());
        }
    }

    // Validate allowlist
    if allowlist.len() > MAX_PARTICIPANTS {
        return Err(RetroError::MaxParticipantsReached.into());
    }

    // Deserialize and validate team registry
    let mut team_registry = TeamRegistry::deserialize(&mut &team_registry_info.data.borrow()[..])?;
    if !team_registry.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if team_registry.team_authority != *team_authority_info.key {
        return Err(RetroError::UnauthorizedTeamAuthority.into());
    }

    let session_index = team_registry.session_count;
    let (pda, bump) = Pubkey::find_program_address(
        &[
            SESSION_SEED,
            team_authority_info.key.as_ref(),
            &session_index.to_le_bytes(),
        ],
        program_id,
    );

    if pda != *session_info.key {
        return Err(RetroError::InvalidPDA.into());
    }

    let rent = Rent::get()?;
    let space = RetroSession::MAX_LEN;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            team_authority_info.key,
            session_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            team_authority_info.clone(),
            session_info.clone(),
            system_program_info.clone(),
        ],
        &[&[
            SESSION_SEED,
            team_authority_info.key.as_ref(),
            &session_index.to_le_bytes(),
            &[bump],
        ]],
    )?;

    let clock = Clock::get()?;
    let session = RetroSession {
        is_initialized: true,
        team_authority: *team_authority_info.key,
        facilitator: *team_authority_info.key,
        session_index,
        stage: SessionStage::Setup,
        closed: false,
        categories,
        allowlist,
        voting_credits_per_participant: voting_credits_per_participant.unwrap_or(VOTING_CREDITS_DEFAULT),
        note_count: 0,
        group_count: 0,
        created_at_slot: clock.slot,
        stage_changed_at_slot: clock.slot,
        bump,
    };

    session.serialize(&mut *session_info.data.borrow_mut())?;

    // Create ParticipantEntry for each allowlist member (enables session discovery)
    for participant_pubkey in &session.allowlist {
        let participant_entry_info = next_account_info(account_info_iter)?;

        let (pda, participant_bump) = Pubkey::find_program_address(
            &[PARTICIPANT_SEED, session_info.key.as_ref(), participant_pubkey.as_ref()],
            program_id,
        );

        if pda != *participant_entry_info.key {
            return Err(RetroError::InvalidPDA.into());
        }

        let space = ParticipantEntry::LEN;
        let lamports = rent.minimum_balance(space);

        invoke_signed(
            &system_instruction::create_account(
                team_authority_info.key,
                participant_entry_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[
                team_authority_info.clone(),
                participant_entry_info.clone(),
                system_program_info.clone(),
            ],
            &[&[PARTICIPANT_SEED, session_info.key.as_ref(), participant_pubkey.as_ref(), &[participant_bump]]],
        )?;

        let entry = ParticipantEntry {
            is_initialized: true,
            session: *session_info.key,
            participant: *participant_pubkey,
            credits_spent: 0,
            bump: participant_bump,
        };
        entry.serialize(&mut *participant_entry_info.data.borrow_mut())?;
    }

    // Update team registry
    team_registry.session_count += 1;
    team_registry.serialize(&mut *team_registry_info.data.borrow_mut())?;

    Ok(())
}

fn process_advance_stage(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    new_stage: SessionStage,
) -> ProgramResult {
    msg!("Instruction: AdvanceStage");
    let account_info_iter = &mut accounts.iter();

    let session_info = next_account_info(account_info_iter)?;
    let facilitator_info = next_account_info(account_info_iter)?;

    if !facilitator_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if session_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let mut session = RetroSession::deserialize(&mut &session_info.data.borrow()[..])?;
    if !session.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if session.facilitator != *facilitator_info.key {
        return Err(RetroError::UnauthorizedFacilitator.into());
    }
    if session.closed {
        return Err(RetroError::SessionClosed.into());
    }
    if !session.stage.can_advance_to(new_stage) {
        return Err(RetroError::InvalidStageTransition.into());
    }

    let clock = Clock::get()?;
    session.stage = new_stage;
    session.stage_changed_at_slot = clock.slot;

    session.serialize(&mut *session_info.data.borrow_mut())?;

    Ok(())
}

fn process_close_session(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    msg!("Instruction: CloseSession");
    let account_info_iter = &mut accounts.iter();

    let session_info = next_account_info(account_info_iter)?;
    let facilitator_info = next_account_info(account_info_iter)?;

    if !facilitator_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if session_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let mut session = RetroSession::deserialize(&mut &session_info.data.borrow()[..])?;
    if !session.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if session.facilitator != *facilitator_info.key {
        return Err(RetroError::UnauthorizedFacilitator.into());
    }
    if session.closed {
        return Err(RetroError::SessionClosed.into());
    }
    if session.stage != SessionStage::Discuss {
        return Err(RetroError::InvalidStage.into());
    }

    session.closed = true;
    session.serialize(&mut *session_info.data.borrow_mut())?;

    Ok(())
}

fn process_create_note(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    category_id: u8,
    content: String,
) -> ProgramResult {
    msg!("Instruction: CreateNote");
    let account_info_iter = &mut accounts.iter();

    let session_info = next_account_info(account_info_iter)?;
    let note_info = next_account_info(account_info_iter)?;
    let author_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    if !author_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if session_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let mut session = RetroSession::deserialize(&mut &session_info.data.borrow()[..])?;
    if !session.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if session.closed {
        return Err(RetroError::SessionClosed.into());
    }
    if session.stage != SessionStage::WriteNotes {
        return Err(RetroError::InvalidStage.into());
    }

    if !session.allowlist.contains(author_info.key) {
        return Err(RetroError::NotOnAllowlist.into());
    }

    if content.len() > MAX_NOTE_CHARS {
        return Err(RetroError::NoteTooLong.into());
    }
    if category_id as usize >= session.categories.len() {
        return Err(RetroError::InvalidCategoryId.into());
    }

    let note_id = session.note_count;
    let (pda, bump) = Pubkey::find_program_address(
        &[NOTE_SEED, session_info.key.as_ref(), &note_id.to_le_bytes()],
        program_id,
    );

    if pda != *note_info.key {
        return Err(RetroError::InvalidPDA.into());
    }

    let rent = Rent::get()?;
    let space = Note::MAX_LEN;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            author_info.key,
            note_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            author_info.clone(),
            note_info.clone(),
            system_program_info.clone(),
        ],
        &[&[NOTE_SEED, session_info.key.as_ref(), &note_id.to_le_bytes(), &[bump]]],
    )?;

    let clock = Clock::get()?;
    let note = Note {
        is_initialized: true,
        session: *session_info.key,
        note_id,
        author: *author_info.key,
        category_id,
        content,
        created_at_slot: clock.slot,
        group_id: None,
        bump,
    };

    note.serialize(&mut *note_info.data.borrow_mut())?;

    session.note_count += 1;
    session.serialize(&mut *session_info.data.borrow_mut())?;

    Ok(())
}

fn process_create_group(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
) -> ProgramResult {
    msg!("Instruction: CreateGroup");
    let account_info_iter = &mut accounts.iter();

    let session_info = next_account_info(account_info_iter)?;
    let group_info = next_account_info(account_info_iter)?;
    let creator_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    if !creator_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if session_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let mut session = RetroSession::deserialize(&mut &session_info.data.borrow()[..])?;
    if !session.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if session.closed {
        return Err(RetroError::SessionClosed.into());
    }
    if session.stage != SessionStage::GroupDuplicates {
        return Err(RetroError::InvalidStage.into());
    }

    // Check allowlist
    if !session.allowlist.contains(creator_info.key) {
        return Err(RetroError::NotOnAllowlist.into());
    }

    if title.len() > MAX_GROUP_TITLE_CHARS {
        return Err(RetroError::GroupTitleTooLong.into());
    }

    let group_id = session.group_count;
    let (pda, bump) = Pubkey::find_program_address(
        &[GROUP_SEED, session_info.key.as_ref(), &group_id.to_le_bytes()],
        program_id,
    );

    if pda != *group_info.key {
        return Err(RetroError::InvalidPDA.into());
    }

    let rent = Rent::get()?;
    let space = Group::MAX_LEN;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            creator_info.key,
            group_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            creator_info.clone(),
            group_info.clone(),
            system_program_info.clone(),
        ],
        &[&[GROUP_SEED, session_info.key.as_ref(), &group_id.to_le_bytes(), &[bump]]],
    )?;

    let group = Group {
        is_initialized: true,
        session: *session_info.key,
        group_id,
        title,
        created_by: *creator_info.key,
        vote_tally: 0,
        bump,
    };

    group.serialize(&mut *group_info.data.borrow_mut())?;

    session.group_count += 1;
    session.serialize(&mut *session_info.data.borrow_mut())?;

    Ok(())
}

fn process_set_group_title(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _group_id: u64,
    title: String,
) -> ProgramResult {
    msg!("Instruction: SetGroupTitle");
    let account_info_iter = &mut accounts.iter();

    let session_info = next_account_info(account_info_iter)?;
    let group_info = next_account_info(account_info_iter)?;
    let participant_info = next_account_info(account_info_iter)?;

    if !participant_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if session_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let session = RetroSession::deserialize(&mut &session_info.data.borrow()[..])?;
    if !session.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if session.closed {
        return Err(RetroError::SessionClosed.into());
    }
    if session.stage != SessionStage::GroupDuplicates {
        return Err(RetroError::InvalidStage.into());
    }

    // Check allowlist
    if !session.allowlist.contains(participant_info.key) {
        return Err(RetroError::NotOnAllowlist.into());
    }

    if title.len() > MAX_GROUP_TITLE_CHARS {
        return Err(RetroError::GroupTitleTooLong.into());
    }

    let mut group = Group::deserialize(&mut &group_info.data.borrow()[..])?;
    if !group.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }

    group.title = title;
    group.serialize(&mut *group_info.data.borrow_mut())?;

    Ok(())
}

fn process_assign_note_to_group(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _note_id: u64,
    group_id: u64,
) -> ProgramResult {
    msg!("Instruction: AssignNoteToGroup");
    let account_info_iter = &mut accounts.iter();

    let session_info = next_account_info(account_info_iter)?;
    let note_info = next_account_info(account_info_iter)?;
    let group_info = next_account_info(account_info_iter)?;
    let participant_info = next_account_info(account_info_iter)?;

    if !participant_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if session_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let session = RetroSession::deserialize(&mut &session_info.data.borrow()[..])?;
    if !session.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if session.closed {
        return Err(RetroError::SessionClosed.into());
    }
    if session.stage != SessionStage::GroupDuplicates {
        return Err(RetroError::InvalidStage.into());
    }

    // Check allowlist
    if !session.allowlist.contains(participant_info.key) {
        return Err(RetroError::NotOnAllowlist.into());
    }

    let group = Group::deserialize(&mut &group_info.data.borrow()[..])?;
    if !group.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }

    let mut note = Note::deserialize(&mut &note_info.data.borrow()[..])?;
    if !note.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if note.group_id.is_some() {
        return Err(RetroError::NoteAlreadyGrouped.into());
    }

    note.group_id = Some(group_id);
    note.serialize(&mut *note_info.data.borrow_mut())?;

    Ok(())
}

fn process_unassign_note(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _note_id: u64,
) -> ProgramResult {
    msg!("Instruction: UnassignNote");
    let account_info_iter = &mut accounts.iter();

    let session_info = next_account_info(account_info_iter)?;
    let note_info = next_account_info(account_info_iter)?;
    let participant_info = next_account_info(account_info_iter)?;

    if !participant_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if session_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let session = RetroSession::deserialize(&mut &session_info.data.borrow()[..])?;
    if !session.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if session.closed {
        return Err(RetroError::SessionClosed.into());
    }
    if session.stage != SessionStage::GroupDuplicates {
        return Err(RetroError::InvalidStage.into());
    }

    // Check allowlist
    if !session.allowlist.contains(participant_info.key) {
        return Err(RetroError::NotOnAllowlist.into());
    }

    let mut note = Note::deserialize(&mut &note_info.data.borrow()[..])?;
    if !note.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if note.group_id.is_none() {
        return Err(RetroError::NoteNotGrouped.into());
    }

    note.group_id = None;
    note.serialize(&mut *note_info.data.borrow_mut())?;

    Ok(())
}

fn process_cast_vote(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    group_id: u64,
    credits_delta: u8,
) -> ProgramResult {
    msg!("Instruction: CastVote");
    let account_info_iter = &mut accounts.iter();

    let session_info = next_account_info(account_info_iter)?;
    let participant_entry_info = next_account_info(account_info_iter)?;
    let group_info = next_account_info(account_info_iter)?;
    let vote_record_info = next_account_info(account_info_iter)?;
    let voter_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    if !voter_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if session_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let session = RetroSession::deserialize(&mut &session_info.data.borrow()[..])?;
    if !session.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if session.closed {
        return Err(RetroError::SessionClosed.into());
    }
    if session.stage != SessionStage::Vote {
        return Err(RetroError::InvalidStage.into());
    }

    // Check allowlist
    if !session.allowlist.contains(voter_info.key) {
        return Err(RetroError::NotOnAllowlist.into());
    }

    if credits_delta == 0 {
        return Err(RetroError::CannotDecreaseVotes.into());
    }

    // Verify ParticipantEntry PDA
    let (participant_pda, participant_bump) = Pubkey::find_program_address(
        &[PARTICIPANT_SEED, session_info.key.as_ref(), voter_info.key.as_ref()],
        program_id,
    );

    if participant_pda != *participant_entry_info.key {
        return Err(RetroError::InvalidPDA.into());
    }

    // Create or load ParticipantEntry (lazy creation on first vote)
    let mut participant_entry = if participant_entry_info.data_is_empty() {
        let rent = Rent::get()?;
        let space = ParticipantEntry::LEN;
        let lamports = rent.minimum_balance(space);

        invoke_signed(
            &system_instruction::create_account(
                voter_info.key,
                participant_entry_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[
                voter_info.clone(),
                participant_entry_info.clone(),
                system_program_info.clone(),
            ],
            &[&[PARTICIPANT_SEED, session_info.key.as_ref(), voter_info.key.as_ref(), &[participant_bump]]],
        )?;

        ParticipantEntry {
            is_initialized: true,
            session: *session_info.key,
            participant: *voter_info.key,
            credits_spent: 0,
            bump: participant_bump,
        }
    } else {
        ParticipantEntry::deserialize(&mut &participant_entry_info.data.borrow()[..])?
    };

    let total_credits_after = participant_entry.credits_spent
        .checked_add(credits_delta)
        .ok_or(RetroError::InsufficientCredits)?;

    if total_credits_after > session.voting_credits_per_participant {
        return Err(RetroError::InsufficientCredits.into());
    }

    let mut group = Group::deserialize(&mut &group_info.data.borrow()[..])?;
    if !group.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }

    let (vote_pda, vote_bump) = Pubkey::find_program_address(
        &[VOTE_SEED, session_info.key.as_ref(), voter_info.key.as_ref(), &group_id.to_le_bytes()],
        program_id,
    );

    if vote_pda != *vote_record_info.key {
        return Err(RetroError::InvalidPDA.into());
    }

    // Check if vote record needs to be created
    let mut vote_record = if vote_record_info.data_is_empty() {
        let rent = Rent::get()?;
        let space = VoteRecord::LEN;
        let lamports = rent.minimum_balance(space);

        invoke_signed(
            &system_instruction::create_account(
                voter_info.key,
                vote_record_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[
                voter_info.clone(),
                vote_record_info.clone(),
                system_program_info.clone(),
            ],
            &[&[VOTE_SEED, session_info.key.as_ref(), voter_info.key.as_ref(), &group_id.to_le_bytes(), &[vote_bump]]],
        )?;

        VoteRecord {
            is_initialized: true,
            session: *session_info.key,
            participant: *voter_info.key,
            group_id,
            credits_spent: 0,
            bump: vote_bump,
        }
    } else {
        VoteRecord::deserialize(&mut &vote_record_info.data.borrow()[..])?
    };

    vote_record.credits_spent = vote_record.credits_spent
        .checked_add(credits_delta)
        .ok_or(RetroError::InsufficientCredits)?;
    vote_record.serialize(&mut *vote_record_info.data.borrow_mut())?;

    participant_entry.credits_spent = total_credits_after;
    participant_entry.serialize(&mut *participant_entry_info.data.borrow_mut())?;

    group.vote_tally = group.vote_tally
        .checked_add(credits_delta as u64)
        .ok_or(RetroError::InsufficientCredits)?;
    group.serialize(&mut *group_info.data.borrow_mut())?;

    Ok(())
}
