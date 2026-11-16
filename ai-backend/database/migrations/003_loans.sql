-- 003: loan transaction types (borrowed / lent money and repayments).
-- Loan movements change cash but are never income or expenses.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN (
  'income','expense','transfer','investment','withdrawal','savings_contribution','savings_withdrawal',
  'refund','reimbursement','adjustment','loan_received','loan_repayment','loan_given','loan_collected'));
