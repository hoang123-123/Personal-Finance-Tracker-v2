import { Transaction, TransactionType, TransactionSource } from './types';

export const initialActualBalance = { 
  amount: 5000000, 
  date: new Date().toISOString() 
};

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth();

// Function to create a date in the current month for realistic sample data
const createDate = (day: number) => new Date(currentYear, currentMonth, day).toISOString();

export const initialTransactions: Transaction[] = [
  {
    id: 'txn-income-001',
    date: createDate(15),
    description: 'Lương tháng',
    amount: 17700000,
    type: TransactionType.INCOME,
    source: TransactionSource.GENERAL,
  },
  {
    id: 'txn-transfer-001',
    date: createDate(16),
    description: 'Trích lương vào quỹ dự phòng',
    amount: 2000000,
    type: TransactionType.TRANSFER,
    source: TransactionSource.GENERAL,
    destination: TransactionSource.PROVISION,
  },
  {
    id: 'txn-001',
    date: createDate(2),
    description: 'Cà phê sáng',
    amount: 45000,
    type: TransactionType.EXPENSE,
    source: TransactionSource.GENERAL,
  },
  {
    id: 'txn-002',
    date: createDate(2),
    description: 'Ăn trưa văn phòng',
    amount: 55000,
    type: TransactionType.EXPENSE,
    source: TransactionSource.GENERAL,
  },
  {
    id: 'txn-003',
    date: createDate(3),
    description: 'Đi siêu thị mua đồ dùng',
    amount: 750000,
    type: TransactionType.EXPENSE,
    source: TransactionSource.GENERAL,
  },
  {
    id: 'txn-004',
    date: createDate(5),
    description: 'Đóng tiền điện',
    amount: 450000,
    type: TransactionType.EXPENSE,
    source: TransactionSource.PROVISION,
  },
  {
    id: 'txn-005',
    date: createDate(5),
    description: 'Đóng tiền nước',
    amount: 150000,
    type: TransactionType.EXPENSE,
    source: TransactionSource.PROVISION,
  },
  {
    id: 'txn-006',
    date: createDate(7),
    description: 'Ăn tối cùng bạn bè',
    amount: 600000,
    type: TransactionType.EXPENSE,
    source: TransactionSource.GENERAL,
  },
   {
    id: 'txn-007',
    date: new Date(currentYear, currentMonth - 1, 28).toISOString(),
    description: 'Mua sắm tháng trước',
    amount: 1200000,
    type: TransactionType.EXPENSE,
    source: TransactionSource.GENERAL,
  },
].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
