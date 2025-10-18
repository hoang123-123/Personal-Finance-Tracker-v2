export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
}

export enum TransactionSource {
  GENERAL = 'GENERAL',
  PROVISION = 'PROVISION',
}

export interface Transaction {
  id: string;
  date: string; // ISO string format
  description: string;
  amount: number;
  type: TransactionType;
  source: TransactionSource;
  destination?: TransactionSource; // For transfers
  rowIndex?: number; // The row number in the Google Sheet
}

export interface MonthlyData {
  month: string; // "YYYY-MM" format
  income: number;
  expense: number;
}

export interface DailyData {
    day: string; // "DD"
    expense: number;
}