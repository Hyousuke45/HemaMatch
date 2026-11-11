// ============================================================
// SEED DATA (mock mode) — v4
// Realistic Filipino sample data for development and defense demo.
// Every collection here mirrors a table in supabase/schema.sql 1:1,
// so the switch to Supabase changes no UI code.
//
// v4 additions: doctor & business accounts, hospital admin_id /
// description / photo_url, hospital_doctors (applications + roster),
// donor_acceptances (donor + assigned doctor), hospital_notifications
// and hospital conversations.
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
        avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Maria%20Santos&backgroundColor=c1912f',
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
        avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Juan%20Dela%20Cruz&backgroundColor=b6452c',
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
        avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Angela%20Reyes&backgroundColor=8a3033',
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
        is_available: false, // paused donation listing (sync rule: paused offer = not listed)
        avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Miguel%20Lopez&backgroundColor=4d5e5a',
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
        avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Cristina%20Flores&backgroundColor=946b2d',
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
        avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Paolo%20Villanueva&backgroundColor=6b8e9e',
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
    },

    // ---------- v4: doctors ----------
    {
      id: 'u-015',
      email: 'dr.ramos@demo.com',
      password: 'doctor123',
      verified: true,
      profile: {
        id: 'u-015',
        full_name: 'Dr. Elena Ramos',
        role: 'doctor',
        blood_type: 'O+',
        region: 'NCR (Metro Manila)',
        city: 'Manila',
        is_available: false,
        avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Elena%20Ramos&backgroundColor=7a4a21',
        doctor_license_id: 'PRC-0092381',
        specialization: 'Internal Medicine',
        contact_number: '0917-123-4567',
        created_at: '2026-09-06T09:30:00'
      }
    },
    {
      id: 'u-016',
      email: 'dr.aquino@demo.com',
      password: 'doctor123',
      verified: true,
      profile: {
        id: 'u-016',
        full_name: 'Dr. Marco Aquino',
        role: 'doctor',
        blood_type: 'A-',
        region: 'NCR (Metro Manila)',
        city: 'Quezon City',
        is_available: false,
        avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Marco%20Aquino&backgroundColor=33566b',
        doctor_license_id: 'PRC-0077120',
        specialization: 'Hematology',
        contact_number: '0918-555-1234',
        created_at: '2026-09-09T10:00:00'
      }
    },
    {
      id: 'u-017',
      email: 'dr.domingo@demo.com',
      password: 'doctor123',
      verified: true,
      profile: {
        id: 'u-017',
        full_name: 'Dr. Liza Domingo',
        role: 'doctor',
        blood_type: 'B+',
        region: 'Region III (Central Luzon)',
        city: 'San Fernando',
        is_available: false,
        avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Liza%20Domingo&backgroundColor=6b3b52',
        doctor_license_id: 'PRC-0055993',
        specialization: 'Pediatrics',
        contact_number: '0920-777-8899',
        created_at: '2026-09-11T14:20:00'
      }
    },

    // ---------- v4: business (hospital admin) accounts ----------
    {
      id: 'u-012',
      email: 'biz.stmary@demo.com',
      password: 'biz12345',
      verified: true,
      profile: {
        id: 'u-012',
        full_name: 'Corazon Santiago',
        role: 'business',
        blood_type: 'O+',
        region: 'NCR (Metro Manila)',
        city: 'Manila',
        is_available: false,
        avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Corazon%20Santiago&backgroundColor=8a6d1f',
        is_doctor: false, // business admin who is NOT a doctor
        created_at: '2026-09-02T08:30:00'
      }
    },
    {
      id: 'u-013',
      email: 'biz.central@demo.com',
      password: 'biz12345',
      verified: true,
      profile: {
        id: 'u-013',
        full_name: 'Melinda Torres',
        role: 'business',
        blood_type: 'A+',
        region: 'Region III (Central Luzon)',
        city: 'San Fernando',
        is_available: false,
        avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Melinda%20Torres&backgroundColor=4d5e5a',
        is_doctor: false,
        created_at: '2026-09-04T09:10:00'
      }
    },
    {
      id: 'u-014',
      email: 'biz.davao@demo.com',
      password: 'biz12345',
      verified: true,
      profile: {
        id: 'u-014',
        full_name: 'Rodrigo Bautista',
        role: 'business',
        blood_type: 'AB-',
        region: 'Region XI (Davao Region)',
        city: 'Davao City',
        is_available: false,
        avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Rodrigo%20Bautista&backgroundColor=6d2a2a',
        // Business admins inherit the Doctor abilities ONLY if they are also
        // a licensed doctor (client rule) — this account demonstrates that.
        is_doctor: true,
        doctor_license_id: 'PRC-0033120',
        specialization: 'General Surgery',
        contact_number: '0921-222-3344',
        created_at: '2026-09-06T11:40:00'
      }
    },
    {
      id: 'u-018',
      email: 'biz.western@demo.com',
      password: 'biz12345',
      verified: true,
      profile: {
        id: 'u-018',
        full_name: 'Teresita Uy',
        role: 'business',
        blood_type: 'A-',
        region: 'Region VI (Western Visayas)',
        city: 'Iloilo City',
        is_available: false,
        avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Teresita%20Uy&backgroundColor=7a5a2a',
        is_doctor: false,
        created_at: '2026-09-18T10:05:00'
      }
    }
  ];

  const hospitals = [
    {
      id: 'h-001',
      admin_id: 'u-012', // Corazon Santiago (business)
      name: 'St. Mary General Hospital',
      region: 'NCR (Metro Manila)',
      city: 'Manila',
      address: '123 España Boulevard, Sampaloc, Manila',
      contact_number: '(02) 8123-4567',
      description:
        'A tertiary general hospital in the heart of Manila with a 24/7 blood bank, trauma center and maternal care services. St. Mary coordinates volunteer donors with its on-duty physicians so every unit is screened and witnessed before transfusion.',
      photo_url: 'https://picsum.photos/seed/stmaryhospital/1200/560',
      status: 'verified',
      notes: 'License verified by administrator.',
      created_at: '2026-09-10T09:00:00'
    },
    {
      id: 'h-002',
      admin_id: 'u-013', // Melinda Torres (business)
      name: 'Central Luzon Medical Center',
      region: 'Region III (Central Luzon)',
      city: 'San Fernando',
      address: 'McArthur Highway, San Fernando, Pampanga',
      contact_number: '(045) 456-7890',
      description:
        'The referral medical center of Central Luzon, housing a regional blood center, dialysis unit and surgical complex. Its physician-led donor program witnesses every HemaMatch transaction held on site.',
      photo_url: 'https://picsum.photos/seed/centralclinic/1200/560',
      status: 'verified',
      notes: 'License verified by administrator.',
      created_at: '2026-09-14T10:30:00'
    },
    {
      id: 'h-003',
      admin_id: 'u-014', // Rodrigo Bautista (business, also a doctor)
      name: 'Davao Regional Hospital',
      region: 'Region XI (Davao Region)',
      city: 'Davao City',
      address: 'Southern Philippine Avenue, Davao City',
      contact_number: '(082) 222-3333',
      description:
        'Mindanao\u2019s largest government regional hospital, with an emergency blood reserve and an outpatient transfusion unit. Managed by Dr. Rodrigo Bautista, a practicing general surgeon who also witnesses donations personally.',
      photo_url: 'https://picsum.photos/seed/davaoregional/1200/560',
      status: 'pending',
      notes: 'Awaiting license confirmation.',
      created_at: '2026-10-15T14:00:00'
    },
    {
      id: 'h-004',
      admin_id: 'u-018', // Teresita Uy (business)
      name: 'Western Visayas Medical Center',
      region: 'Region VI (Western Visayas)',
      city: 'Iloilo City',
      address: 'Quezon Street, Mandurriao, Iloilo City',
      contact_number: '(033) 321-1234',
      description:
        'The premiere medical center of Western Visayas, operating a regional blood bank with 24/7 transfusion services. Its physician-led donor program screens and witnesses every HemaMatch donation held on site.',
      photo_url: 'https://picsum.photos/seed/westernvisayas/1200/560',
      status: 'verified',
      notes: 'License verified by administrator.',
      created_at: '2026-09-18T10:10:00'
    }
  ];

  // v4: doctor applications / hospital roster.
  // status 'accepted' = the doctor is part of the hospital.
  const hospital_doctors = [
    {
      id: 'hd-001',
      hospital_id: 'h-001',
      doctor_id: 'u-015', // Dr. Elena Ramos
      status: 'accepted',
      application_note: 'Internal medicine consultant at St. Mary since 2021.',
      reviewed_by: 'u-012',
      reviewed_at: '2026-09-12T10:00:00',
      created_at: '2026-09-11T09:00:00'
    },
    {
      id: 'hd-002',
      hospital_id: 'h-001',
      doctor_id: 'u-016', // Dr. Marco Aquino
      status: 'accepted',
      application_note: 'Hematologist — handles the blood bank referrals.',
      reviewed_by: 'u-012',
      reviewed_at: '2026-09-13T15:30:00',
      created_at: '2026-09-12T11:20:00'
    },
    {
      id: 'hd-003',
      hospital_id: 'h-002',
      doctor_id: 'u-017', // Dr. Liza Domingo
      status: 'accepted',
      application_note: 'Pediatrician covering the NICU transfusion cases.',
      reviewed_by: 'u-013',
      reviewed_at: '2026-09-16T09:45:00',
      created_at: '2026-09-15T08:30:00'
    },
    {
      id: 'hd-004',
      hospital_id: 'h-001',
      doctor_id: 'u-017', // Dr. Liza Domingo applied to St. Mary too — PENDING demo
      status: 'pending',
      application_note: 'I also hold clinic hours in Manila and can witness donations there.',
      reviewed_by: null,
      reviewed_at: null,
      created_at: '2026-10-20T09:15:00'
    }
  ];

  const requests = [
    {
      id: 'r-001',
      requester_id: 'u-009', // Grace (AB+)
      blood_type: 'O+',
      preferred_donor_types: ['O-'], // v4.1: from the compatible-types checkboxes
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
      preferred_donor_types: [],
      units_needed: 2,
      region: 'Region VI (Western Visayas)',
      hospital_id: 'h-004',
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
      preferred_donor_types: [],
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
      preferred_donor_types: [],
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
      preferred_donor_types: [],
      units_needed: 1,
      region: 'Region IV-A (CALABARZON)',
      hospital_id: 'h-001',
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
      // v4.1 demo of the multi-select checkboxes: an A- patient can
      // receive from O- and A- — both are checked.
      preferred_donor_types: ['O-', 'A-'],
      units_needed: 2,
      region: 'Region VI (Western Visayas)',
      hospital_id: 'h-004',
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
      preferred_donor_types: [],
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

  // v4: donor acceptances — a donor accepting a request, with the doctor
  // assigned to that transaction (the witness / middleman). The doctor must
  // belong to the hospital the request specified.
  const donor_acceptances = [
    {
      id: 'da-001',
      request_id: 'r-003', // Miguel's B+ request at Central Luzon Medical Center
      donor_id: 'u-002', // Maria (O- universal donor)
      doctor_id: 'u-017', // Dr. Liza Domingo (h-002 roster)
      status: 'accepted',
      created_at: '2026-10-15T10:00:00',
      updated_at: '2026-10-15T10:00:00'
    },
    {
      id: 'da-002',
      request_id: 'r-007', // Angela's B- request at St. Mary
      donor_id: 'u-002', // Maria
      doctor_id: 'u-015', // Dr. Elena Ramos (h-001 roster)
      status: 'accepted',
      created_at: '2026-10-17T08:30:00',
      updated_at: '2026-10-17T08:30:00'
    },
    {
      id: 'da-003',
      request_id: 'r-004', // Sofia's completed O- request at St. Mary
      donor_id: 'u-010', // Paolo
      doctor_id: 'u-016', // Dr. Marco Aquino (h-001 roster)
      status: 'completed',
      created_at: '2026-10-11T09:05:00',
      updated_at: '2026-10-12T16:00:00'
    }
  ];

  // v4: notifications for the hospital (read by the business admin).
  const hospital_notifications = [
    {
      id: 'hn-001',
      hospital_id: 'h-001',
      type: 'new_request',
      title: 'New blood request attached to your hospital',
      body: 'Grace Lim created a critical O+ request (3 units) for St. Mary General Hospital.',
      request_id: 'r-001',
      actor_id: 'u-009',
      read: false,
      created_at: '2026-10-18T08:30:00'
    },
    {
      id: 'hn-002',
      hospital_id: 'h-001',
      type: 'donor_accepted',
      title: 'A donor accepted a request at your hospital',
      body: 'Maria Santos accepted the B- request of Angela Reyes — assigned doctor: Dr. Elena Ramos.',
      request_id: 'r-007',
      actor_id: 'u-002',
      read: true,
      created_at: '2026-10-17T08:30:00'
    },
    {
      id: 'hn-003',
      hospital_id: 'h-001',
      type: 'doctor_application',
      title: 'New doctor application',
      body: 'Dr. Liza Domingo (PRC-0055993, Pediatrics) applied to join St. Mary General Hospital.',
      request_id: null,
      actor_id: 'u-017',
      read: false,
      created_at: '2026-10-20T09:15:00'
    },
    {
      id: 'hn-004',
      hospital_id: 'h-002',
      type: 'new_request',
      title: 'New blood request attached to your hospital',
      body: 'Miguel Lopez created an urgent B+ request (4 units) for Central Luzon Medical Center.',
      request_id: 'r-003',
      actor_id: 'u-006',
      read: true,
      created_at: '2026-10-14T09:15:00'
    }
  ];

  const conversations = [
    {
      id: 'c-001',
      request_id: 'r-003',
      hospital_id: null,
      created_by: 'u-006',
      created_at: '2026-10-15T10:05:00'
    },
    {
      id: 'c-002',
      request_id: 'r-004',
      hospital_id: null,
      created_by: 'u-011',
      created_at: '2026-10-11T09:00:00'
    },
    // v4: a HOSPITAL conversation — messages go to the admin, and the
    // chat header displays the hospital name.
    {
      id: 'c-003',
      request_id: null,
      hospital_id: 'h-001',
      created_by: 'u-009',
      created_at: '2026-10-18T09:00:00'
    }
  ];

  // Join table: which user participates in which conversation.
  const conversation_participants = [
    { id: 'cp-001', conversation_id: 'c-001', user_id: 'u-006' },
    { id: 'cp-002', conversation_id: 'c-001', user_id: 'u-002' },
    { id: 'cp-003', conversation_id: 'c-002', user_id: 'u-011' },
    { id: 'cp-004', conversation_id: 'c-002', user_id: 'u-010' },
    // hospital chat: Grace <-> Corazon (St. Mary's business admin)
    { id: 'cp-005', conversation_id: 'c-003', user_id: 'u-009' },
    { id: 'cp-006', conversation_id: 'c-003', user_id: 'u-012' }
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
    },
    {
      id: 'm-007',
      conversation_id: 'c-003',
      sender_id: 'u-009',
      content:
        'Good morning! I posted an O+ critical request for my father\u2019s surgery at your hospital. Is the blood bank open for walk-in volunteer donors this weekend?',
      created_at: '2026-10-18T09:00:30'
    },
    {
      id: 'm-008',
      conversation_id: 'c-003',
      sender_id: 'u-012',
      content:
        'Good morning, Grace. Yes — the blood bank is open 24/7, but an O+ or O- donor should be screened by the on-duty physician first. Dr. Elena Ramos is on duty this weekend; she will witness the donation personally.',
      created_at: '2026-10-18T09:20:00'
    }
  ];

  // ============================================================
  // DONATION OFFERS ("donate" side)
  // One voluntary listing per donor. status 'open' = listed in the
  // donor directory AND included in request matching; 'paused' = hidden
  // from both. profiles.is_available is kept in sync by the backend
  // (mock logic here, trigger + RPC in schema.sql).
  // ============================================================
  const donation_offers = [
    {
      id: 'o-001',
      donor_id: 'u-002', // Maria (O-, Quezon City)
      note: 'Universal donor (O-) here. I usually donate on weekends — Quezon City or nearby Manila blood banks. Message me anytime.',
      status: 'open',
      created_at: '2026-09-20T09:00:00',
      updated_at: '2026-09-20T09:00:00'
    },
    {
      id: 'o-002',
      donor_id: 'u-003', // Juan (A+, Antipolo)
      note: 'Willing to travel within CALABARZON and nearby Metro Manila hospitals. Prefer weekends.',
      status: 'open',
      created_at: '2026-09-22T15:30:00',
      updated_at: '2026-09-22T15:30:00'
    },
    {
      id: 'o-003',
      donor_id: 'u-004', // Angela (B+, Makati)
      note: 'Available weekday mornings. Regular donor at St. Mary General Hospital blood bank.',
      status: 'open',
      created_at: '2026-10-02T11:15:00',
      updated_at: '2026-10-02T11:15:00'
    },
    {
      id: 'o-004',
      donor_id: 'u-007', // Cristina (O+, Iloilo)
      note: 'Based in Iloilo City — happy to help patients anywhere in Western Visayas.',
      status: 'open',
      created_at: '2026-10-04T08:20:00',
      updated_at: '2026-10-04T08:20:00'
    },
    {
      id: 'o-005',
      donor_id: 'u-010', // Paolo (O-, Bacoor)
      note: 'O- donor in Bacoor. I can reach Makati or Taguig hospitals with a day\u2019s notice.',
      status: 'open',
      created_at: '2026-10-06T17:45:00',
      updated_at: '2026-10-06T17:45:00'
    },
    {
      id: 'o-006',
      donor_id: 'u-006', // Miguel (AB-, Pampanga) — demonstrates the paused state
      note: 'Pausing for now — back after my next eligibility date. Thank you!',
      status: 'paused',
      created_at: '2026-09-25T10:00:00',
      updated_at: '2026-10-10T19:00:00'
    }
  ];

  // Admin outcome records ("transaction records" in this academic app).
  // v4: doctor_id = the assigned doctor who witnessed the transaction.
  const donation_records = [
    {
      id: 'dr-001',
      request_id: 'r-004',
      donor_id: 'u-010', // Paolo (O-) donated for Sofia's O- request
      doctor_id: 'u-016', // Dr. Marco Aquino witnessed it (St. Mary roster)
      outcome: 'successful',
      reason: 'Donation completed at St. Mary General Hospital blood bank.',
      recorded_by: 'u-001',
      created_at: '2026-10-12T16:00:00'
    },
    {
      id: 'dr-002',
      request_id: 'r-007',
      donor_id: 'u-002', // Maria (O-) attempted for Angela's B- request
      doctor_id: 'u-015', // Dr. Elena Ramos (witness)
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
      details: 'O+ request created (NCR, critical). St. Mary General Hospital notified.',
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
    },
    {
      id: 'al-007',
      actor_id: 'u-002',
      actor_name: 'Maria Santos',
      action: 'acceptance.created',
      entity: 'donor_acceptances',
      entity_id: 'da-002',
      details: 'Donor accepted request r-007 — assigned doctor: Dr. Elena Ramos (St. Mary General Hospital).',
      created_at: '2026-10-17T08:30:00'
    },
    {
      id: 'al-008',
      actor_id: 'u-012',
      actor_name: 'Corazon Santiago',
      action: 'doctor_application.accepted',
      entity: 'hospital_doctors',
      entity_id: 'hd-001',
      details: 'Dr. Elena Ramos accepted into St. Mary General Hospital.',
      created_at: '2026-09-12T10:00:00'
    }
  ];

  return {
    currentUserId: null,
    users,
    hospitals,
    hospital_doctors,
    hospital_notifications,
    requests,
    donor_acceptances,
    conversations,
    conversation_participants,
    messages,
    donation_offers,
    donation_records,
    activity_logs
  };
}
