-- Add vendor setup form fields
ALTER TABLE resellers
  ADD COLUMN IF NOT EXISTS address_country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS billing_address_street VARCHAR(255),
  ADD COLUMN IF NOT EXISTS billing_address_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS billing_address_state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS billing_address_zip VARCHAR(20),
  ADD COLUMN IF NOT EXISTS billing_address_country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS website VARCHAR(255),
  ADD COLUMN IF NOT EXISTS finance_contact_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS finance_contact_title VARCHAR(100),
  ADD COLUMN IF NOT EXISTS finance_contact_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS finance_contact_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bank_address VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bank_aba VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_swift VARCHAR(50);
