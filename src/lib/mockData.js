// ============================================================
// PHASE 1 SEED DATA (mock mode)
// Realistic Filipino sample data for development and defense demo.
// Every collection here mirrors a table in supabase/schema.sql 1:1,
// so the switch to Supabase in Phase 2 changes no UI code.
// ============================================================

export function createSeedDb() {
  const users = [
    {
      id: 'u-001',
      email: 'admin@demo.com',
      password: 'admin123', // MOCK ONLY - Supabase Auth hashes passwords; we never store them ourselves
      verified: true,
      profile: {
        id: 'u-001',
        full_name: 'Ana Villanueva',
        role: 'admin',
        blood_type: 'O+',
        region: 'NCR (Metro Manila)',
        city: 'Manila',
        is_available: false,
        created_at: '2026-09-01T08:00:00'
      }
    },
    {
      id: 'u-002',
      email: 'maria@demo.com',
      password: 'maria123',
      verified: true,
      profile: {
        id: 'u-002',
        full_name: 'Maria Santos',
        role: 'user',
        blood_type: 'O-',
        region: 'NCR (Metro Manila)',
        city: 'Quezon City',
        is_available: true,
        created_at: '2026-09-03T10:15:00'
      }
    },
    {
      id: 'u-003',
      email: 'juan@demo.com',
      password: 'juan123',
      verified: true,
      profile: {
        id: 'u-003',
        full_name: 'Juan Dela Cruz',
        role: 'user',
        blood_type: 'A+',
        region: 'Region IV-A (CALABARZON)',
        city: 'Antipolo',
        is_available: true,
        created_at: '2026-09-05T14:30:00'
      }
    },
    {
      id: 'u-004',
      email: 'angela@demo.com',
      password: 'angela123',
      verified: true,
      profile: {
        id: 'u-004',
        full_name: 'Angela Reyes',
        role: 'user',
        blood_type: 'B+',
        region: 'NCR (Metro Manila)',
        city: 'Makati',
        is_available: true,
        created_at: '2026-09-08T09:00:00'
      }
    },
    {
      id: 'u-005',
      email: 'pedro@demo.com',
      password: 'pedro123',
      verified: true,
      profile: {
        id: 'u-005',
        full_name: 'Pedro Ramos',
        role: 'user',
        blood_type: 'B+',
        region: 'NCR (Metro Manila)',
        city: 'Pasig',
        is_available: false, // intentionally unavailable: demonstrates the availability filter
        created_at: '2026-09-10T11:45:00'
      }
    },
    {
      id: 'u-006',
      email: 'miguel@demo.com',
      password: 'miguel123',
      verified: true,
      profile: {
        id: 'u-006',
        full_name: 'Miguel Lopez',
        role: 'user',
        blood_type: 'AB-',
        region: 'Region III (Central Luzon)',
        city: 'San Fernando',
        is_available: true,
        created_at: '2026-09-12T16:20:00'
      }
    },
    {
      id: 'u-007',
      email: 'cristina@demo.com',
      password: 'cristina123',
      verified: true,
      profile: {
        id: 'u-007',
        full_name: 'Cristina Flores',
        role: 'user',
        blood_type: 'O+',
        region: 'Region VI (Western Visayas)',
        city: 'Iloilo City',
        is_available: true,
        created_at: '2026-09-15T08:40:00'
      }
    },
    {
      id: 'u-008',
      email: 'rafael@demo.com',
      password: 'rafael123',
      verified: true,
      profile: {
        id: 'u-008',
        full_name: 'Rafael Mendoza',
        role: 'user',
        blood_type: 'A-',
        region: 'Region XI (Davao Region)',
        city: 'Davao City',
        is_available: true,
        created_at: '2026-09-18T13:05:00'
      }
    },
    {
      id: 'u-009',
      email: 'grace@demo.com',
      password: 'grace123',
      verified: true,
      profile: {
        id: 'u-009',
        full_name: 'Grace Lim',
        role: 'user',
        blood_type: 'AB+',
        region: 'NCR (Metro Manila)',
        city: 'Taguig',
        is_available: false,
        created_at: '2026-09-22T15:50:00'
      }
    },
    {
      id: 'u-010',
      email: 'paolo@demo.com',
      password: 'paolo123',
      verified: true,
      profile: {
        id: 'u-010',
        full_name: 'Paolo Villanueva',
        role: 'user',
        blood_type: 'O-',
        region: 'Region IV-A (CALABARZON)',
        city: 'Bacoor',
        is_available: true,
        created_at: '2026-10-01T10:10:00'
      }
    },
    {
      id: 'u-011',
      email: 'sofia@demo.com',
      password: 'sofia123',
      verified: true,
      profile: {
        id: 'u-011',
        full_name: 'Sofia Garcia',
        role: 'user',
        blood_type: 'B-',
        region: 'NCR (Metro Manila)',
        city: 'Mandaluyong',
        is_available: true,
        created_at: '2026-10-05T12:00:00'
      }
    }
  ];

  const hospitals = [
    {
      id: 'h-001',
      name: 'St. Mary General Hospital',
      region: 'NCR (Metro Manila)',
      city: 'Manila',
      address: '123 España Boulevard, Sampaloc, Manila',
      contact_number: '(02) 8123-4567',
      status: 'verified',
      notes: 'License verified by administrator.',
      created_at: '2026-09-10T09:00:00'
    },
    {
      id: 'h-002',
      name: 'Central Luzon Medical Center',
      region: 'Region III (Central Luzon)',
      city: 'San Fernando',
      address: 'McArthur Highway, San Fernando, Pampanga',
      contact_number: '(045) 456-7890',
      status: 'verified',
      notes: 'License verified by administrator.',
      created_at: '2026-09-14T10:30:00'
    },
    {
      id: 'h-003',
      name: 'Davao Regional Hospital',
      region: 'Region XI (Davao Region)',
      city: 'Davao City',
      address: 'Southern Philippine Avenue, Davao City',
      contact_number: '(082) 222-3333',
      status: 'pending',
      notes: 'Awaiting license confirmation.',
      created_at: '2026-10-15T14:00:00'
    }
  ];

  const requests = [
    {
      id: 'r-001',
      requester_id: 'u-009', // Grace (AB+)
      blood_type: 'O+',
      units_needed: 3,
      region: 'NCR (Metro Manila)',
      hospital_id: 'h-001',
      urgency: 'critical',
      needed_by: '2026-10-24',
      description:
        'Patient scheduled for major surgery at St. Mary General Hospital needs O+ blood. Coordination with the hospital blood bank is ongoing.',
      status: 'pending',
      created_at: '2026-10-18T08:30:00',
      updated_at: '2026-10-18T08:30:00'
    },
    {
      id: 'r-002',
      requester_id: 'u-007', // Cristina (O+)
      blood_type: 'A+',
      units_needed: 2,
      region: 'Region VI (Western Visayas)',
      hospital_id: null,
      urgency: 'routine',
      needed_by: null,
      description:
        'Relative admitted at a local hospital in Iloilo needs A+ blood for a follow-up transfusion.',
      status: 'pending',
      created_at: '2026-10-19T11:00:00',
      updated_at: '2026-10-19T11:00:00'
    },
    {
      id: 'r-003',
      requester_id: 'u-006', // Miguel (AB-)
      blood_type: 'B+',
      units_needed: 4,
      region: 'Region III (Central Luzon)',
      hospital_id: 'h-002',
      urgency: 'urgent',
      needed_by: '2026-10-22',
      description:
        'Father needs B+ units for an operation at Central Luzon Medical Center. Donors matched through this app will still go through standard screening.',
      status: 'accepted',
      created_at: '2026-10-14T09:15:00',
      updated_at: '2026-10-15T10:00:00'
    },
    {
      id: 'r-004',
      requester_id: 'u-011', // Sofia (B-)
      blood_type: 'O-',
      units_needed: 2,
      region: 'NCR (Metro Manila)',
      hospital_id: 'h-001',
      urgency: 'critical',
      needed_by: null,
      description: 'Newborn niece needs O- blood at St. Mary General Hospital NICU.',
      status: 'completed',
      created_at: '2026-10-10T07:45:00',
      updated_at: '2026-10-12T16:00:00'
    },
    {
      id: 'r-005',
      requester_id: 'u-003', // Juan (A+)
      blood_type: 'AB+',
      units_needed: 1,
      region: 'Region IV-A (CALABARZON)',
      hospital_id: null,
      urgency: 'routine',
      needed_by: null,
      description: 'Reserved unit no longer needed.',
      status: 'cancelled',
      created_at: '2026-10-12T13:20:00',
      updated_at: '2026-10-13T09:10:00'
    },
    {
      id: 'r-006',
      requester_id: 'u-010', // Paolo (O-)
      blood_type: 'A-',
      units_needed: 2,
      region: 'Region VI (Western Visayas)',
      hospital_id: null,
      urgency: 'urgent',
      needed_by: '2026-10-27',
      description:
        'Grandmother in Iloilo needs A- blood after surgery. Willing to coordinate donor travel.',
      status: 'pending',
      created_at: '2026-10-19T16:40:00',
      updated_at: '2026-10-19T16:40:00'
    },
    {
      id: 'r-007',
      requester_id: 'u-004', // Angela (B+)
      blood_type: 'B-',
      units_needed: 3,
      region: 'NCR (Metro Manila)',
      hospital_id: 'h-001',
      urgency: 'critical',
      needed_by: '2026-10-21',
      description:
        'Brother needs B- blood for an emergency procedure. A previous donor was deferred at screening, still looking for donors.',
      status: 'accepted',
      created_at: '2026-10-16T18:05:00',
      updated_at: '2026-10-17T08:30:00'
    }
  ];

  const conversations = [
    {
      id: 'c-001',
      request_id: 'r-003',
      created_by: 'u-006',
      created_at: '2026-10-15T10:05:00'
    },
    {
      id: 'c-002',
      request_id: 'r-004',
      created_by: 'u-011',
      created_at: '2026-10-11T09:00:00'
    }
  ];

  // Join table: which user participates in which conversation.
  const conversation_participants = [
    { id: 'cp-001', conversation_id: 'c-001', user_id: 'u-006' },
    { id: 'cp-002', conversation_id: 'c-001', user_id: 'u-002' },
    { id: 'cp-003', conversation_id: 'c-002', user_id: 'u-011' },
    { id: 'cp-004', conversation_id: 'c-002', user_id: 'u-010' }
  ];

  const messages = [
    {
      id: 'm-001',
      conversation_id: 'c-001',
      sender_id: 'u-006',
      content:
        'Hi Maria! I saw you are an O- donor. My father needs B+ blood in San Fernando, Pampanga. O- works for him too. Would you be available this week?',
      created_at: '2026-10-15T10:05:30'
    },
    {
      id: 'm-002',
      conversation_id: 'c-001',
      sender_id: 'u-002',
      content:
        'Hi Miguel, sorry to hear that. Yes, I can try to help. I will pass by the hospital blood bank for the standard screening first.',
      created_at: '2026-10-15T10:32:00'
    },
    {
      id: 'm-003',
      conversation_id: 'c-001',
      sender_id: 'u-006',
      content: 'Thank you so much! I marked the request as accepted. See you at the hospital.',
      created_at: '2026-10-15T11:02:00'
    },
    {
      id: 'm-004',
      conversation_id: 'c-002',
      sender_id: 'u-011',
      content:
        'Hi Paolo! Our niece needs O- blood at St. Mary. You are an O- donor in Bacoor — would you consider donating?',
      created_at: '2026-10-11T09:00:30'
    },
    {
      id: 'm-005',
      conversation_id: 'c-002',
      sender_id: 'u-010',
      content: 'Of course. I will schedule the screening tomorrow morning.',
      created_at: '2026-10-11T12:45:00'
    },
    {
      id: 'm-006',
      conversation_id: 'c-002',
      sender_id: 'u-011',
      content: 'The transfusion went well. Thank you so much, you saved our family a lot of worry!',
      created_at: '2026-10-12T16:02:00'
    }
  ];

  // Admin outcome records ("transaction records" in this academic app)
  const donation_records = [
    {
      id: 'dr-001',
      request_id: 'r-004',
      donor_id: 'u-010', // Paolo (O-) donated for Sofia's O- request
      outcome: 'successful',
      reason: 'Donation completed at St. Mary General Hospital blood bank.',
      recorded_by: 'u-001',
      created_at: '2026-10-12T16:00:00'
    },
    {
      id: 'dr-002',
      request_id: 'r-007',
      donor_id: 'u-002', // Maria (O-) attempted for Angela's B- request
      outcome: 'failed',
      reason: 'Donor deferred during screening (low hemoglobin level). Request stays open for other donors.',
      recorded_by: 'u-001',
      created_at: '2026-10-17T08:30:00'
    }
  ];

  // Trigger-written audit trail (in Phase 2 these rows are written by
  // PostgreSQL triggers, never by client code)
  const activity_logs = [
    {
      id: 'al-001',
      actor_id: 'u-009',
      actor_name: 'Grace Lim',
      action: 'request.created',
      entity: 'donation_requests',
      entity_id: 'r-001',
      details: 'O+ request created (NCR, critical).',
      created_at: '2026-10-18T08:30:00'
    },
    {
      id: 'al-002',
      actor_id: 'u-006',
      actor_name: 'Miguel Lopez',
      action: 'request.status_changed',
      entity: 'donation_requests',
      entity_id: 'r-003',
      details: 'Status changed from pending to accepted by requester.',
      created_at: '2026-10-15T10:00:00'
    },
    {
      id: 'al-003',
      actor_id: 'u-001',
      actor_name: 'Ana Villanueva',
      action: 'record.created',
      entity: 'donation_records',
      entity_id: 'dr-001',
      details: 'Outcome recorded: successful.',
      created_at: '2026-10-12T16:00:00'
    },
    {
      id: 'al-004',
      actor_id: 'u-001',
      actor_name: 'Ana Villanueva',
      action: 'record.created',
      entity: 'donation_records',
      entity_id: 'dr-002',
      details: 'Outcome recorded: failed (donor deferred at screening).',
      created_at: '2026-10-17T08:30:00'
    },
    {
      id: 'al-005',
      actor_id: 'u-001',
      actor_name: 'Ana Villanueva',
      action: 'hospital.status_changed',
      entity: 'hospitals',
      entity_id: 'h-002',
      details: 'Hospital verified by administrator.',
      created_at: '2026-09-14T10:30:00'
    },
    {
      id: 'al-006',
      actor_id: 'u-011',
      actor_name: 'Sofia Garcia',
      action: 'request.cancelled',
      entity: 'donation_requests',
      entity_id: 'r-005',
      details: 'Request cancelled by Juan Dela Cruz (no longer needed).',
      created_at: '2026-10-13T09:10:00'
    }
  ];

  return {
    currentUserId: null,
    users,
    hospitals,
    requests,
    conversations,
    conversation_participants,
    messages,
    donation_records,
    activity_logs
  };
}
