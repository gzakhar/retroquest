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
        RetroInstruction::InitFacilitatorRegistry => {
            process_init_facilitator_registry(program_id, accounts)
        }
        RetroInstruction::CreateBoard {
            categories,
            allowlist,
            voting_credits_per_participant,
        } => process_create_board(
            program_id,
            accounts,
            categories,
            allowlist,
            voting_credits_per_participant,
        ),
        RetroInstruction::AdvanceStage { new_stage } => {
            process_advance_stage(program_id, accounts, new_stage)
        }
        RetroInstruction::CloseBoard => {
            process_close_board(program_id, accounts)
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
        RetroInstruction::CreateActionItem {
            description,
            owner,
            verifiers,
            threshold,
        } => process_create_action_item(program_id, accounts, description, owner, verifiers, threshold),
        RetroInstruction::CastVerificationVote {
            action_item_id,
            approved,
        } => process_cast_verification_vote(program_id, accounts, action_item_id, approved),
    }
}

fn process_init_facilitator_registry(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    msg!("Instruction: InitFacilitatorRegistry");
    let account_info_iter = &mut accounts.iter();

    let registry_info = next_account_info(account_info_iter)?;
    let facilitator_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    if !facilitator_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let (pda, bump) = Pubkey::find_program_address(
        &[FACILITATOR_REGISTRY_SEED, facilitator_info.key.as_ref()],
        program_id,
    );

    if pda != *registry_info.key {
        return Err(RetroError::InvalidPDA.into());
    }

    let rent = Rent::get()?;
    let space = FacilitatorRegistry::LEN;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            facilitator_info.key,
            registry_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            facilitator_info.clone(),
            registry_info.clone(),
            system_program_info.clone(),
        ],
        &[&[FACILITATOR_REGISTRY_SEED, facilitator_info.key.as_ref(), &[bump]]],
    )?;

    let registry = FacilitatorRegistry {
        is_initialized: true,
        facilitator: *facilitator_info.key,
        board_count: 0,
        bump,
    };

    registry.serialize(&mut *registry_info.data.borrow_mut())?;

    Ok(())
}

fn process_create_board(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    categories: Vec<String>,
    allowlist: Vec<Pubkey>,
    voting_credits_per_participant: Option<u8>,
) -> ProgramResult {
    msg!("Instruction: CreateBoard");
    let account_info_iter = &mut accounts.iter();

    let registry_info = next_account_info(account_info_iter)?;
    let board_info = next_account_info(account_info_iter)?;
    let facilitator_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    if !facilitator_info.is_signer {
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

    // Deserialize and validate facilitator registry
    let mut registry = FacilitatorRegistry::deserialize(&mut &registry_info.data.borrow()[..])?;
    if !registry.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if registry.facilitator != *facilitator_info.key {
        return Err(RetroError::UnauthorizedFacilitator.into());
    }

    let board_index = registry.board_count;
    let (pda, bump) = Pubkey::find_program_address(
        &[
            BOARD_SEED,
            facilitator_info.key.as_ref(),
            &board_index.to_le_bytes(),
        ],
        program_id,
    );

    if pda != *board_info.key {
        return Err(RetroError::InvalidPDA.into());
    }

    let rent = Rent::get()?;
    let space = RetroBoard::MAX_LEN;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            facilitator_info.key,
            board_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            facilitator_info.clone(),
            board_info.clone(),
            system_program_info.clone(),
        ],
        &[&[
            BOARD_SEED,
            facilitator_info.key.as_ref(),
            &board_index.to_le_bytes(),
            &[bump],
        ]],
    )?;

    let clock = Clock::get()?;
    let board = RetroBoard {
        is_initialized: true,
        facilitator: *facilitator_info.key,
        board_index,
        stage: BoardStage::Setup,
        closed: false,
        categories,
        allowlist,
        voting_credits_per_participant: voting_credits_per_participant.unwrap_or(VOTING_CREDITS_DEFAULT),
        note_count: 0,
        group_count: 0,
        action_item_count: 0,
        created_at_slot: clock.slot,
        stage_changed_at_slot: clock.slot,
        bump,
    };

    board.serialize(&mut *board_info.data.borrow_mut())?;

    // Create BoardMembership for each allowlist member (enables board discovery)
    for participant_pubkey in &board.allowlist {
        let membership_info = next_account_info(account_info_iter)?;

        let (pda, membership_bump) = Pubkey::find_program_address(
            &[MEMBERSHIP_SEED, board_info.key.as_ref(), participant_pubkey.as_ref()],
            program_id,
        );

        if pda != *membership_info.key {
            return Err(RetroError::InvalidPDA.into());
        }

        let space = BoardMembership::LEN;
        let lamports = rent.minimum_balance(space);

        invoke_signed(
            &system_instruction::create_account(
                facilitator_info.key,
                membership_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[
                facilitator_info.clone(),
                membership_info.clone(),
                system_program_info.clone(),
            ],
            &[&[MEMBERSHIP_SEED, board_info.key.as_ref(), participant_pubkey.as_ref(), &[membership_bump]]],
        )?;

        let membership = BoardMembership {
            is_initialized: true,
            board: *board_info.key,
            participant: *participant_pubkey,
            credits_spent: 0,
            total_score: 0,
            bump: membership_bump,
        };
        membership.serialize(&mut *membership_info.data.borrow_mut())?;
    }

    // Update facilitator registry
    registry.board_count += 1;
    registry.serialize(&mut *registry_info.data.borrow_mut())?;

    Ok(())
}

fn process_advance_stage(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    new_stage: BoardStage,
) -> ProgramResult {
    msg!("Instruction: AdvanceStage");
    let account_info_iter = &mut accounts.iter();

    let board_info = next_account_info(account_info_iter)?;
    let facilitator_info = next_account_info(account_info_iter)?;

    if !facilitator_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if board_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let mut board = RetroBoard::deserialize(&mut &board_info.data.borrow()[..])?;
    if !board.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if board.facilitator != *facilitator_info.key {
        return Err(RetroError::UnauthorizedFacilitator.into());
    }
    if board.closed {
        return Err(RetroError::BoardClosed.into());
    }
    if !board.stage.can_advance_to(new_stage) {
        return Err(RetroError::InvalidStageTransition.into());
    }

    let clock = Clock::get()?;
    board.stage = new_stage;
    board.stage_changed_at_slot = clock.slot;

    board.serialize(&mut *board_info.data.borrow_mut())?;

    Ok(())
}

fn process_close_board(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    msg!("Instruction: CloseBoard");
    let account_info_iter = &mut accounts.iter();

    let board_info = next_account_info(account_info_iter)?;
    let facilitator_info = next_account_info(account_info_iter)?;

    if !facilitator_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if board_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let mut board = RetroBoard::deserialize(&mut &board_info.data.borrow()[..])?;
    if !board.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if board.facilitator != *facilitator_info.key {
        return Err(RetroError::UnauthorizedFacilitator.into());
    }
    if board.closed {
        return Err(RetroError::BoardClosed.into());
    }
    if board.stage != BoardStage::Discuss {
        return Err(RetroError::InvalidStage.into());
    }

    board.closed = true;
    board.serialize(&mut *board_info.data.borrow_mut())?;

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

    let board_info = next_account_info(account_info_iter)?;
    let note_info = next_account_info(account_info_iter)?;
    let author_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    if !author_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if board_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let mut board = RetroBoard::deserialize(&mut &board_info.data.borrow()[..])?;
    if !board.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if board.closed {
        return Err(RetroError::BoardClosed.into());
    }
    if board.stage != BoardStage::WriteNotes {
        return Err(RetroError::InvalidStage.into());
    }

    if !board.allowlist.contains(author_info.key) {
        return Err(RetroError::NotOnAllowlist.into());
    }

    if content.len() > MAX_NOTE_CHARS {
        return Err(RetroError::NoteTooLong.into());
    }
    if category_id as usize >= board.categories.len() {
        return Err(RetroError::InvalidCategoryId.into());
    }

    let note_id = board.note_count;
    let (pda, bump) = Pubkey::find_program_address(
        &[NOTE_SEED, board_info.key.as_ref(), &note_id.to_le_bytes()],
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
        &[&[NOTE_SEED, board_info.key.as_ref(), &note_id.to_le_bytes(), &[bump]]],
    )?;

    let clock = Clock::get()?;
    let note = Note {
        is_initialized: true,
        board: *board_info.key,
        note_id,
        author: *author_info.key,
        category_id,
        content,
        created_at_slot: clock.slot,
        group_id: None,
        bump,
    };

    note.serialize(&mut *note_info.data.borrow_mut())?;

    board.note_count += 1;
    board.serialize(&mut *board_info.data.borrow_mut())?;

    Ok(())
}

fn process_create_group(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
) -> ProgramResult {
    msg!("Instruction: CreateGroup");
    let account_info_iter = &mut accounts.iter();

    let board_info = next_account_info(account_info_iter)?;
    let group_info = next_account_info(account_info_iter)?;
    let creator_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    if !creator_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if board_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let mut board = RetroBoard::deserialize(&mut &board_info.data.borrow()[..])?;
    if !board.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if board.closed {
        return Err(RetroError::BoardClosed.into());
    }
    if board.stage != BoardStage::GroupDuplicates {
        return Err(RetroError::InvalidStage.into());
    }

    // Check allowlist
    if !board.allowlist.contains(creator_info.key) {
        return Err(RetroError::NotOnAllowlist.into());
    }

    if title.len() > MAX_GROUP_TITLE_CHARS {
        return Err(RetroError::GroupTitleTooLong.into());
    }

    let group_id = board.group_count;
    let (pda, bump) = Pubkey::find_program_address(
        &[GROUP_SEED, board_info.key.as_ref(), &group_id.to_le_bytes()],
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
        &[&[GROUP_SEED, board_info.key.as_ref(), &group_id.to_le_bytes(), &[bump]]],
    )?;

    let group = Group {
        is_initialized: true,
        board: *board_info.key,
        group_id,
        title,
        created_by: *creator_info.key,
        vote_tally: 0,
        bump,
    };

    group.serialize(&mut *group_info.data.borrow_mut())?;

    board.group_count += 1;
    board.serialize(&mut *board_info.data.borrow_mut())?;

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

    let board_info = next_account_info(account_info_iter)?;
    let group_info = next_account_info(account_info_iter)?;
    let participant_info = next_account_info(account_info_iter)?;

    if !participant_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if board_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let board = RetroBoard::deserialize(&mut &board_info.data.borrow()[..])?;
    if !board.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if board.closed {
        return Err(RetroError::BoardClosed.into());
    }
    if board.stage != BoardStage::GroupDuplicates {
        return Err(RetroError::InvalidStage.into());
    }

    // Check allowlist
    if !board.allowlist.contains(participant_info.key) {
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

    let board_info = next_account_info(account_info_iter)?;
    let note_info = next_account_info(account_info_iter)?;
    let group_info = next_account_info(account_info_iter)?;
    let participant_info = next_account_info(account_info_iter)?;

    if !participant_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if board_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let board = RetroBoard::deserialize(&mut &board_info.data.borrow()[..])?;
    if !board.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if board.closed {
        return Err(RetroError::BoardClosed.into());
    }
    if board.stage != BoardStage::GroupDuplicates {
        return Err(RetroError::InvalidStage.into());
    }

    // Check allowlist
    if !board.allowlist.contains(participant_info.key) {
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

    let board_info = next_account_info(account_info_iter)?;
    let note_info = next_account_info(account_info_iter)?;
    let participant_info = next_account_info(account_info_iter)?;

    if !participant_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if board_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let board = RetroBoard::deserialize(&mut &board_info.data.borrow()[..])?;
    if !board.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if board.closed {
        return Err(RetroError::BoardClosed.into());
    }
    if board.stage != BoardStage::GroupDuplicates {
        return Err(RetroError::InvalidStage.into());
    }

    // Check allowlist
    if !board.allowlist.contains(participant_info.key) {
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

    let board_info = next_account_info(account_info_iter)?;
    let membership_info = next_account_info(account_info_iter)?;
    let group_info = next_account_info(account_info_iter)?;
    let vote_record_info = next_account_info(account_info_iter)?;
    let voter_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    if !voter_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if board_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let board = RetroBoard::deserialize(&mut &board_info.data.borrow()[..])?;
    if !board.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if board.closed {
        return Err(RetroError::BoardClosed.into());
    }
    if board.stage != BoardStage::Vote {
        return Err(RetroError::InvalidStage.into());
    }

    // Check allowlist
    if !board.allowlist.contains(voter_info.key) {
        return Err(RetroError::NotOnAllowlist.into());
    }

    if credits_delta == 0 {
        return Err(RetroError::CannotDecreaseVotes.into());
    }

    // Verify BoardMembership PDA
    let (membership_pda, membership_bump) = Pubkey::find_program_address(
        &[MEMBERSHIP_SEED, board_info.key.as_ref(), voter_info.key.as_ref()],
        program_id,
    );

    if membership_pda != *membership_info.key {
        return Err(RetroError::InvalidPDA.into());
    }

    // Create or load BoardMembership (lazy creation on first vote for backward compatibility)
    let mut membership = if membership_info.data_is_empty() {
        let rent = Rent::get()?;
        let space = BoardMembership::LEN;
        let lamports = rent.minimum_balance(space);

        invoke_signed(
            &system_instruction::create_account(
                voter_info.key,
                membership_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[
                voter_info.clone(),
                membership_info.clone(),
                system_program_info.clone(),
            ],
            &[&[MEMBERSHIP_SEED, board_info.key.as_ref(), voter_info.key.as_ref(), &[membership_bump]]],
        )?;

        BoardMembership {
            is_initialized: true,
            board: *board_info.key,
            participant: *voter_info.key,
            credits_spent: 0,
            total_score: 0,
            bump: membership_bump,
        }
    } else {
        BoardMembership::deserialize(&mut &membership_info.data.borrow()[..])?
    };

    let total_credits_after = membership.credits_spent
        .checked_add(credits_delta)
        .ok_or(RetroError::InsufficientCredits)?;

    if total_credits_after > board.voting_credits_per_participant {
        return Err(RetroError::InsufficientCredits.into());
    }

    let mut group = Group::deserialize(&mut &group_info.data.borrow()[..])?;
    if !group.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }

    let (vote_pda, vote_bump) = Pubkey::find_program_address(
        &[VOTE_SEED, board_info.key.as_ref(), voter_info.key.as_ref(), &group_id.to_le_bytes()],
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
            &[&[VOTE_SEED, board_info.key.as_ref(), voter_info.key.as_ref(), &group_id.to_le_bytes(), &[vote_bump]]],
        )?;

        VoteRecord {
            is_initialized: true,
            board: *board_info.key,
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

    membership.credits_spent = total_credits_after;
    membership.serialize(&mut *membership_info.data.borrow_mut())?;

    group.vote_tally = group.vote_tally
        .checked_add(credits_delta as u64)
        .ok_or(RetroError::InsufficientCredits)?;
    group.serialize(&mut *group_info.data.borrow_mut())?;

    Ok(())
}

fn process_create_action_item(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    description: String,
    owner: Pubkey,
    verifiers: Vec<Pubkey>,
    threshold: u8,
) -> ProgramResult {
    msg!("Instruction: CreateActionItem");
    let account_info_iter = &mut accounts.iter();

    let board_info = next_account_info(account_info_iter)?;
    let action_item_info = next_account_info(account_info_iter)?;
    let facilitator_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    if !facilitator_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if board_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let mut board = RetroBoard::deserialize(&mut &board_info.data.borrow()[..])?;
    if !board.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if board.closed {
        return Err(RetroError::BoardClosed.into());
    }
    if board.stage != BoardStage::Discuss {
        return Err(RetroError::InvalidStage.into());
    }
    if board.facilitator != *facilitator_info.key {
        return Err(RetroError::UnauthorizedFacilitator.into());
    }

    // Validate description length
    if description.len() > MAX_ACTION_DESCRIPTION_CHARS {
        return Err(RetroError::ActionDescriptionTooLong.into());
    }

    // Validate verifiers count
    if verifiers.len() > MAX_VERIFIERS {
        return Err(RetroError::TooManyVerifiers.into());
    }

    // Validate threshold
    if threshold == 0 {
        return Err(RetroError::ThresholdTooLow.into());
    }
    if threshold as usize > verifiers.len() {
        return Err(RetroError::ThresholdTooHigh.into());
    }

    // Validate owner is on allowlist
    if !board.allowlist.contains(&owner) {
        return Err(RetroError::NotOnAllowlist.into());
    }

    // Validate all verifiers are on allowlist and owner is not a verifier
    for verifier in &verifiers {
        if !board.allowlist.contains(verifier) {
            return Err(RetroError::NotOnAllowlist.into());
        }
        if *verifier == owner {
            return Err(RetroError::OwnerCannotVerify.into());
        }
    }

    let action_item_id = board.action_item_count;
    let (pda, bump) = Pubkey::find_program_address(
        &[ACTION_ITEM_SEED, board_info.key.as_ref(), &action_item_id.to_le_bytes()],
        program_id,
    );

    if pda != *action_item_info.key {
        return Err(RetroError::InvalidPDA.into());
    }

    let rent = Rent::get()?;
    let space = ActionItem::MAX_LEN;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            facilitator_info.key,
            action_item_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            facilitator_info.clone(),
            action_item_info.clone(),
            system_program_info.clone(),
        ],
        &[&[ACTION_ITEM_SEED, board_info.key.as_ref(), &action_item_id.to_le_bytes(), &[bump]]],
    )?;

    let clock = Clock::get()?;
    let action_item = ActionItem {
        is_initialized: true,
        board: *board_info.key,
        action_item_id,
        description,
        owner,
        verifiers,
        threshold,
        approvals: 0,
        status: ActionItemStatus::Pending,
        created_at_slot: clock.slot,
        verified_at_slot: None,
        bump,
    };

    action_item.serialize(&mut *action_item_info.data.borrow_mut())?;

    board.action_item_count += 1;
    board.serialize(&mut *board_info.data.borrow_mut())?;

    Ok(())
}

fn process_cast_verification_vote(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _action_item_id: u64,
    approved: bool,
) -> ProgramResult {
    msg!("Instruction: CastVerificationVote");
    let account_info_iter = &mut accounts.iter();

    let board_info = next_account_info(account_info_iter)?;
    let action_item_info = next_account_info(account_info_iter)?;
    let vote_info = next_account_info(account_info_iter)?;
    let owner_membership_info = next_account_info(account_info_iter)?;
    let verifier_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    if !verifier_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if board_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let board = RetroBoard::deserialize(&mut &board_info.data.borrow()[..])?;
    if !board.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    // Board must be closed for verification
    if !board.closed {
        return Err(RetroError::BoardNotClosed.into());
    }

    if action_item_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let mut action_item = ActionItem::deserialize(&mut &action_item_info.data.borrow()[..])?;
    if !action_item.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if action_item.status != ActionItemStatus::Pending {
        return Err(RetroError::ActionItemNotPending.into());
    }

    // Validate verifier is in the action item's verifiers list
    if !action_item.verifiers.contains(verifier_info.key) {
        return Err(RetroError::NotAVerifier.into());
    }

    // Verify vote PDA
    let (vote_pda, vote_bump) = Pubkey::find_program_address(
        &[VERIFICATION_VOTE_SEED, action_item_info.key.as_ref(), verifier_info.key.as_ref()],
        program_id,
    );

    if vote_pda != *vote_info.key {
        return Err(RetroError::InvalidPDA.into());
    }

    // Check vote doesn't already exist
    if !vote_info.data_is_empty() {
        return Err(RetroError::AlreadyVoted.into());
    }

    // Verify owner membership PDA
    let (owner_membership_pda, _) = Pubkey::find_program_address(
        &[MEMBERSHIP_SEED, board_info.key.as_ref(), action_item.owner.as_ref()],
        program_id,
    );

    if owner_membership_pda != *owner_membership_info.key {
        return Err(RetroError::InvalidPDA.into());
    }

    // Create the vote record
    let rent = Rent::get()?;
    let space = VerificationVote::LEN;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            verifier_info.key,
            vote_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            verifier_info.clone(),
            vote_info.clone(),
            system_program_info.clone(),
        ],
        &[&[VERIFICATION_VOTE_SEED, action_item_info.key.as_ref(), verifier_info.key.as_ref(), &[vote_bump]]],
    )?;

    let clock = Clock::get()?;
    let vote = VerificationVote {
        is_initialized: true,
        action_item: *action_item_info.key,
        verifier: *verifier_info.key,
        approved,
        voted_at_slot: clock.slot,
        bump: vote_bump,
    };

    vote.serialize(&mut *vote_info.data.borrow_mut())?;

    // Update action item if approved
    if approved {
        action_item.approvals += 1;

        // Check if threshold is met
        if action_item.approvals >= action_item.threshold {
            action_item.status = ActionItemStatus::Completed;
            action_item.verified_at_slot = Some(clock.slot);

            // Increment owner's score
            let mut owner_membership = BoardMembership::deserialize(&mut &owner_membership_info.data.borrow()[..])?;
            owner_membership.total_score += 1;
            owner_membership.serialize(&mut *owner_membership_info.data.borrow_mut())?;
        }
    }

    action_item.serialize(&mut *action_item_info.data.borrow_mut())?;

    Ok(())
}
