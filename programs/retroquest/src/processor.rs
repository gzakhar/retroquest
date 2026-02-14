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
use session_keys::{validate_signer_or_session, SessionToken, SESSION_TOKEN_SEED};

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
        RetroInstruction::CreateSession {
            valid_until,
            top_up_lamports,
        } => process_create_session(program_id, accounts, valid_until, top_up_lamports),
        RetroInstruction::RevokeSession => process_revoke_session(program_id, accounts),
        RetroInstruction::CreateIdentity { username } => {
            process_create_identity(program_id, accounts, username)
        }
        RetroInstruction::UpdateIdentity { username } => {
            process_update_identity(program_id, accounts, username)
        }
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

    // Determine if session token is present based on account count
    // Without session: registry, board, signer, system, memberships... (4 + allowlist.len())
    // With session: registry, board, signer, system, session_token, memberships... (5 + allowlist.len())
    let num_base_accounts = 4;
    let expected_without_session = num_base_accounts + allowlist.len();
    let expected_with_session = expected_without_session + 1;

    let has_session_token = if accounts.len() == expected_with_session {
        true
    } else if accounts.len() == expected_without_session {
        false
    } else {
        msg!(
            "Invalid account count: got {}, expected {} or {}",
            accounts.len(),
            expected_without_session,
            expected_with_session
        );
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    let account_info_iter = &mut accounts.iter();

    let registry_info = next_account_info(account_info_iter)?;
    let board_info = next_account_info(account_info_iter)?;
    let signer_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    // Optional session token - only consume if present
    let session_token_info = if has_session_token {
        Some(next_account_info(account_info_iter)?)
    } else {
        None
    };

    // Determine the facilitator (authority) - either from session token or direct signer
    let facilitator = if let Some(session_info) = session_token_info {
        let session = SessionToken::deserialize(&mut &session_info.data.borrow()[..])?;
        session.authority
    } else {
        *signer_info.key
    };

    // Validate signer or session
    validate_signer_or_session(
        signer_info,
        &facilitator,
        session_token_info,
        program_id,
        program_id,
    )?;

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
    if registry.facilitator != facilitator {
        return Err(RetroError::UnauthorizedFacilitator.into());
    }

    let board_index = registry.board_count;
    let (pda, bump) = Pubkey::find_program_address(
        &[
            BOARD_SEED,
            facilitator.as_ref(),
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
            signer_info.key,
            board_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            signer_info.clone(),
            board_info.clone(),
            system_program_info.clone(),
        ],
        &[&[
            BOARD_SEED,
            facilitator.as_ref(),
            &board_index.to_le_bytes(),
            &[bump],
        ]],
    )?;

    let clock = Clock::get()?;
    let board = RetroBoard {
        is_initialized: true,
        facilitator,
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
                signer_info.key,
                membership_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[
                signer_info.clone(),
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
    let signer_info = next_account_info(account_info_iter)?;
    // Optional session token for session-based signing
    let session_token_info = next_account_info(account_info_iter).ok();

    // Determine the facilitator (authority) - either from session token or direct signer
    let facilitator = if let Some(session_info) = session_token_info {
        let session = SessionToken::deserialize(&mut &session_info.data.borrow()[..])?;
        session.authority
    } else {
        *signer_info.key
    };

    // Validate signer or session
    validate_signer_or_session(
        signer_info,
        &facilitator,
        session_token_info,
        program_id,
        program_id,
    )?;

    if board_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let mut board = RetroBoard::deserialize(&mut &board_info.data.borrow()[..])?;
    if !board.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if board.facilitator != facilitator {
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
    let signer_info = next_account_info(account_info_iter)?;
    // Optional session token for session-based signing
    let session_token_info = next_account_info(account_info_iter).ok();

    // Determine the facilitator (authority) - either from session token or direct signer
    let facilitator = if let Some(session_info) = session_token_info {
        let session = SessionToken::deserialize(&mut &session_info.data.borrow()[..])?;
        session.authority
    } else {
        *signer_info.key
    };

    // Validate signer or session
    validate_signer_or_session(
        signer_info,
        &facilitator,
        session_token_info,
        program_id,
        program_id,
    )?;

    if board_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    let mut board = RetroBoard::deserialize(&mut &board_info.data.borrow()[..])?;
    if !board.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }
    if board.facilitator != facilitator {
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
    let signer_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;
    // Optional session token for session-based signing
    let session_token_info = next_account_info(account_info_iter).ok();

    // Determine the author (authority) based on signing method
    let author = if let Some(session_info) = session_token_info {
        // Session-based signing: get authority from session token
        let session = SessionToken::deserialize(&mut &session_info.data.borrow()[..])?;
        session.authority
    } else {
        // Direct wallet signing: signer is the author
        *signer_info.key
    };

    // Validate signature (either direct or session-based)
    validate_signer_or_session(
        signer_info,
        &author,
        session_token_info,
        program_id, // session tokens are owned by this program
        program_id, // target program is this program
    )?;

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

    if !board.allowlist.contains(&author) {
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
            signer_info.key,
            note_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            signer_info.clone(),
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
        author,
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
    let signer_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;
    // Optional session token for session-based signing
    let session_token_info = next_account_info(account_info_iter).ok();

    // Determine the creator (authority) based on signing method
    let creator = if let Some(session_info) = session_token_info {
        let session = SessionToken::deserialize(&mut &session_info.data.borrow()[..])?;
        session.authority
    } else {
        *signer_info.key
    };

    // Validate signature (either direct or session-based)
    validate_signer_or_session(
        signer_info,
        &creator,
        session_token_info,
        program_id,
        program_id,
    )?;

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
    if !board.allowlist.contains(&creator) {
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
            signer_info.key,
            group_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            signer_info.clone(),
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
        created_by: creator,
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
    let signer_info = next_account_info(account_info_iter)?;
    // Optional session token for session-based signing
    let session_token_info = next_account_info(account_info_iter).ok();

    // Determine the participant (authority) based on signing method
    let participant = if let Some(session_info) = session_token_info {
        let session = SessionToken::deserialize(&mut &session_info.data.borrow()[..])?;
        session.authority
    } else {
        *signer_info.key
    };

    // Validate signature (either direct or session-based)
    validate_signer_or_session(
        signer_info,
        &participant,
        session_token_info,
        program_id,
        program_id,
    )?;

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
    if !board.allowlist.contains(&participant) {
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
    let signer_info = next_account_info(account_info_iter)?;
    // Optional session token for session-based signing
    let session_token_info = next_account_info(account_info_iter).ok();

    // Determine the participant (authority) based on signing method
    let participant = if let Some(session_info) = session_token_info {
        let session = SessionToken::deserialize(&mut &session_info.data.borrow()[..])?;
        session.authority
    } else {
        *signer_info.key
    };

    // Validate signature (either direct or session-based)
    validate_signer_or_session(
        signer_info,
        &participant,
        session_token_info,
        program_id,
        program_id,
    )?;

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
    if !board.allowlist.contains(&participant) {
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
    let signer_info = next_account_info(account_info_iter)?;
    // Optional session token for session-based signing
    let session_token_info = next_account_info(account_info_iter).ok();

    // Determine the participant (authority) based on signing method
    let participant = if let Some(session_info) = session_token_info {
        let session = SessionToken::deserialize(&mut &session_info.data.borrow()[..])?;
        session.authority
    } else {
        *signer_info.key
    };

    // Validate signature (either direct or session-based)
    validate_signer_or_session(
        signer_info,
        &participant,
        session_token_info,
        program_id,
        program_id,
    )?;

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
    if !board.allowlist.contains(&participant) {
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
    let signer_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;
    // Optional session token for session-based signing
    let session_token_info = next_account_info(account_info_iter).ok();

    // Determine the voter (authority) based on signing method
    let voter = if let Some(session_info) = session_token_info {
        let session = SessionToken::deserialize(&mut &session_info.data.borrow()[..])?;
        session.authority
    } else {
        *signer_info.key
    };

    // Validate signature (either direct or session-based)
    validate_signer_or_session(
        signer_info,
        &voter,
        session_token_info,
        program_id,
        program_id,
    )?;

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
    if !board.allowlist.contains(&voter) {
        return Err(RetroError::NotOnAllowlist.into());
    }

    if credits_delta == 0 {
        return Err(RetroError::CannotDecreaseVotes.into());
    }

    // Verify BoardMembership PDA (uses voter/authority, not session signer)
    let (membership_pda, membership_bump) = Pubkey::find_program_address(
        &[MEMBERSHIP_SEED, board_info.key.as_ref(), voter.as_ref()],
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
                signer_info.key,
                membership_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[
                signer_info.clone(),
                membership_info.clone(),
                system_program_info.clone(),
            ],
            &[&[MEMBERSHIP_SEED, board_info.key.as_ref(), voter.as_ref(), &[membership_bump]]],
        )?;

        BoardMembership {
            is_initialized: true,
            board: *board_info.key,
            participant: voter,
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

    // Verify VoteRecord PDA (uses voter/authority, not session signer)
    let (vote_pda, vote_bump) = Pubkey::find_program_address(
        &[VOTE_SEED, board_info.key.as_ref(), voter.as_ref(), &group_id.to_le_bytes()],
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
                signer_info.key,
                vote_record_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[
                signer_info.clone(),
                vote_record_info.clone(),
                system_program_info.clone(),
            ],
            &[&[VOTE_SEED, board_info.key.as_ref(), voter.as_ref(), &group_id.to_le_bytes(), &[vote_bump]]],
        )?;

        VoteRecord {
            is_initialized: true,
            board: *board_info.key,
            participant: voter,
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
    let signer_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;
    // Optional session token for session-based signing
    let session_token_info = next_account_info(account_info_iter).ok();

    // Determine the facilitator (authority) - either from session token or direct signer
    let facilitator = if let Some(session_info) = session_token_info {
        let session = SessionToken::deserialize(&mut &session_info.data.borrow()[..])?;
        session.authority
    } else {
        *signer_info.key
    };

    // Validate signer or session
    validate_signer_or_session(
        signer_info,
        &facilitator,
        session_token_info,
        program_id,
        program_id,
    )?;

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
    if board.facilitator != facilitator {
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
            signer_info.key,
            action_item_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            signer_info.clone(),
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
    let signer_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;
    // Optional session token for session-based signing
    let session_token_info = next_account_info(account_info_iter).ok();

    // Determine the verifier (authority) based on signing method
    let verifier = if let Some(session_info) = session_token_info {
        let session = SessionToken::deserialize(&mut &session_info.data.borrow()[..])?;
        session.authority
    } else {
        *signer_info.key
    };

    // Validate signature (either direct or session-based)
    validate_signer_or_session(
        signer_info,
        &verifier,
        session_token_info,
        program_id,
        program_id,
    )?;

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
    if !action_item.verifiers.contains(&verifier) {
        return Err(RetroError::NotAVerifier.into());
    }

    // Verify vote PDA (uses verifier/authority, not session signer)
    let (vote_pda, vote_bump) = Pubkey::find_program_address(
        &[VERIFICATION_VOTE_SEED, action_item_info.key.as_ref(), verifier.as_ref()],
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
            signer_info.key,
            vote_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            signer_info.clone(),
            vote_info.clone(),
            system_program_info.clone(),
        ],
        &[&[VERIFICATION_VOTE_SEED, action_item_info.key.as_ref(), verifier.as_ref(), &[vote_bump]]],
    )?;

    let clock = Clock::get()?;
    let vote = VerificationVote {
        is_initialized: true,
        action_item: *action_item_info.key,
        verifier,
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

fn process_create_session(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    valid_until: i64,
    top_up_lamports: Option<u64>,
) -> ProgramResult {
    msg!("Instruction: CreateSession");
    let account_info_iter = &mut accounts.iter();

    let session_token_info = next_account_info(account_info_iter)?;
    let session_signer_info = next_account_info(account_info_iter)?;
    let authority_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    // Both session signer and authority must sign
    if !session_signer_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !authority_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate valid_until is not too far in the future (max 7 days)
    let clock = Clock::get()?;
    let max_valid_until = clock.unix_timestamp + session_keys::MAX_VALIDITY_SECONDS;
    if valid_until > max_valid_until {
        return Err(RetroError::SessionValidityTooLong.into());
    }
    if valid_until <= clock.unix_timestamp {
        return Err(RetroError::SessionAlreadyExpired.into());
    }

    // Derive session token PDA
    // Seeds: ["session_token", target_program, session_signer, authority]
    let (pda, bump) = Pubkey::find_program_address(
        &[
            SESSION_TOKEN_SEED,
            program_id.as_ref(),
            session_signer_info.key.as_ref(),
            authority_info.key.as_ref(),
        ],
        program_id,
    );

    if pda != *session_token_info.key {
        return Err(RetroError::InvalidPDA.into());
    }

    // Create the session token account
    let rent = Rent::get()?;
    let space = SessionToken::LEN;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            authority_info.key,
            session_token_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            authority_info.clone(),
            session_token_info.clone(),
            system_program_info.clone(),
        ],
        &[&[
            SESSION_TOKEN_SEED,
            program_id.as_ref(),
            session_signer_info.key.as_ref(),
            authority_info.key.as_ref(),
            &[bump],
        ]],
    )?;

    // Initialize session token data
    let session_token = SessionToken {
        authority: *authority_info.key,
        target_program: *program_id,
        session_signer: *session_signer_info.key,
        valid_until,
    };

    session_token.serialize(&mut *session_token_info.data.borrow_mut())?;

    // Optionally top up the session signer with lamports for transaction fees
    if let Some(top_up) = top_up_lamports {
        if top_up > 0 {
            invoke_signed(
                &system_instruction::transfer(authority_info.key, session_signer_info.key, top_up),
                &[
                    authority_info.clone(),
                    session_signer_info.clone(),
                    system_program_info.clone(),
                ],
                &[],
            )?;
        }
    }

    msg!("Session created for authority: {}", authority_info.key);
    msg!("Session signer: {}", session_signer_info.key);
    msg!("Valid until: {}", valid_until);

    Ok(())
}

fn process_revoke_session(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    msg!("Instruction: RevokeSession");
    let account_info_iter = &mut accounts.iter();

    let session_token_info = next_account_info(account_info_iter)?;
    let authority_info = next_account_info(account_info_iter)?;

    // Authority must sign
    if !authority_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify account ownership
    if session_token_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    // Deserialize and validate the session token
    let session_token = SessionToken::deserialize(&mut &session_token_info.data.borrow()[..])?;

    // Verify authority matches
    if session_token.authority != *authority_info.key {
        return Err(RetroError::UnauthorizedSessionRevoke.into());
    }

    // Close the account by transferring lamports and zeroing data
    let dest_lamports = authority_info.lamports();
    **authority_info.lamports.borrow_mut() = dest_lamports
        .checked_add(session_token_info.lamports())
        .ok_or(ProgramError::ArithmeticOverflow)?;
    **session_token_info.lamports.borrow_mut() = 0;

    // Zero out the account data
    session_token_info.data.borrow_mut().fill(0);

    msg!("Session revoked for authority: {}", authority_info.key);

    Ok(())
}

// Username validation helper
fn validate_username(username: &str) -> ProgramResult {
    if username.len() < 3 {
        return Err(RetroError::UsernameTooShort.into());
    }
    if username.len() > MAX_USERNAME_CHARS {
        return Err(RetroError::UsernameTooLong.into());
    }
    if !username.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err(RetroError::InvalidUsernameCharacters.into());
    }
    Ok(())
}

fn process_create_identity(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    username: String,
) -> ProgramResult {
    msg!("Instruction: CreateIdentity");
    let account_info_iter = &mut accounts.iter();

    let identity_info = next_account_info(account_info_iter)?;
    let authority_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    // Authority must sign
    if !authority_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate username
    validate_username(&username)?;

    // Derive and verify PDA
    let (pda, bump) = Pubkey::find_program_address(
        &[PARTICIPANT_IDENTITY_SEED, authority_info.key.as_ref()],
        program_id,
    );

    if pda != *identity_info.key {
        return Err(RetroError::InvalidPDA.into());
    }

    // Check if identity already exists
    if !identity_info.data_is_empty() {
        return Err(RetroError::AccountAlreadyInitialized.into());
    }

    // Create account
    let rent = Rent::get()?;
    let space = ParticipantIdentity::MAX_LEN;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            authority_info.key,
            identity_info.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            authority_info.clone(),
            identity_info.clone(),
            system_program_info.clone(),
        ],
        &[&[PARTICIPANT_IDENTITY_SEED, authority_info.key.as_ref(), &[bump]]],
    )?;

    // Initialize identity
    let identity = ParticipantIdentity {
        is_initialized: true,
        authority: *authority_info.key,
        username,
        bump,
    };

    identity.serialize(&mut *identity_info.data.borrow_mut())?;

    msg!("Identity created for authority: {}", authority_info.key);

    Ok(())
}

fn process_update_identity(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    username: String,
) -> ProgramResult {
    msg!("Instruction: UpdateIdentity");
    let account_info_iter = &mut accounts.iter();

    let identity_info = next_account_info(account_info_iter)?;
    let authority_info = next_account_info(account_info_iter)?;

    // Authority must sign
    if !authority_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate username
    validate_username(&username)?;

    // Verify account ownership
    if identity_info.owner != program_id {
        return Err(RetroError::InvalidAccountOwner.into());
    }

    // Deserialize and validate
    let mut identity = ParticipantIdentity::deserialize(&mut &identity_info.data.borrow()[..])?;
    if !identity.is_initialized {
        return Err(RetroError::AccountNotInitialized.into());
    }

    // Verify authority matches
    if identity.authority != *authority_info.key {
        return Err(RetroError::UnauthorizedIdentityUpdate.into());
    }

    // Update username
    identity.username = username;
    identity.serialize(&mut *identity_info.data.borrow_mut())?;

    msg!("Identity updated for authority: {}", authority_info.key);

    Ok(())
}
