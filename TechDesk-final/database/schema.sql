-- =========================================================
-- TECHDESK DATABASE
-- PostgreSQL
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =========================================================
-- ENUMS
-- =========================================================

CREATE TYPE user_role AS ENUM (
    'admin',
    'agent',
    'customer'
);

CREATE TYPE ticket_status AS ENUM (
    'open',
    'in_progress',
    'on_hold',
    'completed'
);

CREATE TYPE ticket_priority AS ENUM (
    'low',
    'medium',
    'high'
);


-- =========================================================
-- COMPANIES
-- Kundenunternehmen
-- =========================================================

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) NOT NULL,

    email VARCHAR(255),

    phone VARCHAR(50),

    address TEXT,

    city VARCHAR(100),

    postal_code VARCHAR(20),

    country VARCHAR(100) DEFAULT 'Switzerland',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- USERS
-- Alle Benutzer von TechDesk
-- =========================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID REFERENCES companies(id)
        ON DELETE SET NULL,

    first_name VARCHAR(100) NOT NULL,

    last_name VARCHAR(100) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,

    role user_role NOT NULL DEFAULT 'customer',

    avatar_url TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- AUTH ACCOUNTS
-- Für Microsoft / Google / Apple Login
-- =========================================================

CREATE TABLE auth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    provider VARCHAR(30) NOT NULL,

    provider_account_id VARCHAR(255) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(provider, provider_account_id)
);


-- =========================================================
-- TICKETS
-- =========================================================

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ticket_number BIGSERIAL UNIQUE,

    company_id UUID
        REFERENCES companies(id)
        ON DELETE SET NULL,

    customer_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    assigned_to UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    title VARCHAR(255) NOT NULL,

    description TEXT NOT NULL,

    status ticket_status NOT NULL DEFAULT 'open',

    priority ticket_priority NOT NULL DEFAULT 'medium',

    category VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    completed_at TIMESTAMPTZ
);


-- =========================================================
-- TICKET COMMENTS
-- Kommunikation zwischen Kunde und ICT-Team
-- =========================================================

CREATE TABLE ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ticket_id UUID NOT NULL
        REFERENCES tickets(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    message TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- TICKET ATTACHMENTS
-- Bilder, PDFs, Logs usw.
-- =========================================================

CREATE TABLE ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ticket_id UUID NOT NULL
        REFERENCES tickets(id)
        ON DELETE CASCADE,

    uploaded_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    file_name VARCHAR(255) NOT NULL,

    file_url TEXT NOT NULL,

    file_size BIGINT,

    mime_type VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- TICKET HISTORY
-- Jede Änderung eines Tickets wird gespeichert
-- =========================================================

CREATE TABLE ticket_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ticket_id UUID NOT NULL
        REFERENCES tickets(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(100) NOT NULL,

    old_value TEXT,

    new_value TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX idx_tickets_status
ON tickets(status);

CREATE INDEX idx_tickets_priority
ON tickets(priority);

CREATE INDEX idx_tickets_company
ON tickets(company_id);

CREATE INDEX idx_tickets_customer
ON tickets(customer_id);

CREATE INDEX idx_tickets_assigned
ON tickets(assigned_to);

CREATE INDEX idx_tickets_created
ON tickets(created_at);

CREATE INDEX idx_comments_ticket
ON ticket_comments(ticket_id);

CREATE INDEX idx_history_ticket
ON ticket_history(ticket_id);

CREATE INDEX idx_users_company
ON users(company_id);


-- =========================================================
-- TESTDATEN
-- =========================================================

INSERT INTO companies (
    name,
    email,
    phone,
    city,
    postal_code,
    country
)
VALUES (
    'Meier AG',
    'info@meier-ag.ch',
    '+41 31 000 00 00',
    'Bern',
    '3000',
    'Switzerland'
);


INSERT INTO companies (
    name,
    email,
    phone,
    city,
    postal_code,
    country
)
VALUES (
    'Schneider GmbH',
    'info@schneider.ch',
    '+41 31 111 11 11',
    'Bern',
    '3011',
    'Switzerland'
);


-- =========================================================
-- TEST USER
-- =========================================================

INSERT INTO users (
    first_name,
    last_name,
    email,
    role
)
VALUES (
    'Max',
    'Muster',
    'max@techdesk.local',
    'admin'
);


-- =========================================================
-- TEST TICKETS
-- =========================================================

INSERT INTO tickets (
    company_id,
    customer_id,
    title,
    description,
    status,
    priority,
    category
)
SELECT
    c.id,
    NULL,
    'Laptop startet nicht',
    'Der Laptop des Mitarbeiters startet seit heute Morgen nicht mehr.',
    'open',
    'high',
    'Hardware'
FROM companies c
WHERE c.name = 'Meier AG';


INSERT INTO tickets (
    company_id,
    title,
    description,
    status,
    priority,
    category
)
SELECT
    c.id,
    'Outlook funktioniert nicht',
    'Outlook lässt sich nicht öffnen.',
    'in_progress',
    'medium',
    'Software'
FROM companies c
WHERE c.name = 'Schneider GmbH';


-- =========================================================
-- STATISTIK-VIEWS
-- =========================================================

-- Tickets nach Status

CREATE VIEW ticket_status_statistics AS
SELECT
    status,
    COUNT(*) AS total
FROM tickets
GROUP BY status;


-- Tickets nach Priorität

CREATE VIEW ticket_priority_statistics AS
SELECT
    priority,
    COUNT(*) AS total
FROM tickets
GROUP BY priority;


-- Tickets pro Tag

CREATE VIEW tickets_per_day AS
SELECT
    DATE(created_at) AS date,
    COUNT(*) AS total
FROM tickets
GROUP BY DATE(created_at)
ORDER BY date;


-- Tickets pro Monat

CREATE VIEW tickets_per_month AS
SELECT
    DATE_TRUNC('month', created_at) AS month,
    COUNT(*) AS total
FROM tickets
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month;


-- Tickets pro Jahr

CREATE VIEW tickets_per_year AS
SELECT
    DATE_TRUNC('year', created_at) AS year,
    COUNT(*) AS total
FROM tickets
GROUP BY DATE_TRUNC('year', created_at)
ORDER BY year;