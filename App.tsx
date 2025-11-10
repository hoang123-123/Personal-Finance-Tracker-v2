import React, { useState, useMemo, useEffect, useCallback } from 'react';
import MonthlyComparisonChart from './components/MonthlyComparisonChart';
import DailyExpenseChart from './components/DailyExpenseChart';
import ConfigSetup from './components/ConfigSetup';
import { Transaction, TransactionType, TransactionSource, MonthlyData, DailyData } from './types';

// Let TypeScript know gapi is a global variable
// Fix: Correctly declare the global `gapi` object on the Window interface to resolve TypeScript errors.
declare global {
  interface Window {
    gapi: any;
  }
}

// --- CONFIGURATION ---
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];
const TRANSACTIONS_SHEET_NAME = 'Transactions';
const CONFIG_SHEET_NAME = 'Config';

// Helper function to format currency in VND
const formatCurrency = (value: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

// Helper function to process raw transactions into monthly summary data for the chart
const processMonthlyData = (transactions: Transaction[]): MonthlyData[] => {
    const monthlySummary: { [key: string]: { income: number, expense: number } } = {};

    transactions.forEach(tx => {
        const month = tx.date.substring(0, 7); // "YYYY-MM"
        if (!monthlySummary[month]) {
            monthlySummary[month] = { income: 0, expense: 0 };
        }

        if (tx.type === TransactionType.INCOME) {
            monthlySummary[month].income += tx.amount;
        } else if (tx.type === TransactionType.EXPENSE) {
            monthlySummary[month].expense += tx.amount;
        }
    });

    return Object.keys(monthlySummary).map(month => ({
        month: month.substring(5, 7), // "MM" for chart label
        income: monthlySummary[month].income,
        expense: monthlySummary[month].expense,
    })).sort((a, b) => a.month.localeCompare(b.month));
};

// Helper function to process raw transactions into daily expense data for the chart
const processDailyData = (transactions: Transaction[], selectedMonth: string): DailyData[] => { // selectedMonth is "YYYY-MM"
    const dailySummary: { [key: string]: number } = {};

    transactions
        .filter(tx => tx.date.startsWith(selectedMonth) && tx.type === TransactionType.EXPENSE)
        .forEach(tx => {
            const day = tx.date.substring(8, 10); // "DD"
            if (!dailySummary[day]) {
                dailySummary[day] = 0;
            }
            dailySummary[day] += tx.amount;
        });
    
    return Object.keys(dailySummary).map(day => ({
        day: day,
        expense: dailySummary[day],
    })).sort((a, b) => a.day.localeCompare(b.day));
};

const App: React.FC = () => {
    // --- State management ---
    const [gapiConfig, setGapiConfig] = useState<{ apiKey: string; clientId: string; spreadsheetId: string} | null>(null);
    const [isGapiScriptLoaded, setIsGapiScriptLoaded] = useState(false);
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // Only for data loading, not script init
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sheetIds, setSheetIds] = useState<{ [key:string]: number }>({});
    
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [initialBalances, setInitialBalances] = useState({ general: '0', provision: '0' });
    const [monthlyIncomeGoal, setMonthlyIncomeGoal] = useState('0');
    const [lastRolloverMonth, setLastRolloverMonth] = useState('');
    
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
    const [newTxData, setNewTxData] = useState({
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        type: TransactionType.EXPENSE,
        source: TransactionSource.GENERAL,
        destination: TransactionSource.GENERAL,
    });
    
    // --- Google Sheets API Logic ---

    // Load GAPI script robustly, ensuring it only runs once.
    useEffect(() => {
        const scriptId = 'google-api-script';
        if (document.getElementById(scriptId) || window.gapi) {
             if (window.gapi) {
                window.gapi.load('client:auth2', () => {
                    setIsGapiScriptLoaded(true);
                });
            }
            return;
        }
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
             window.gapi.load('client:auth2', () => {
                setIsGapiScriptLoaded(true);
            });
        };
        script.onerror = () => {
            setError("Không thể tải thư viện Google. Vui lòng kiểm tra kết nối mạng và thử tải lại trang.");
        };
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
    }, []); // Empty dependency array ensures this effect runs only once.


    // Effect to initialize GAPI client and handle auth flow once config is set.
    useEffect(() => {
        if (!gapiConfig || !isGapiScriptLoaded) {
            return;
        }

        // Define data loading functions here so they close over the correct gapiConfig
        const loadConfigForEffect = async () => {
            const range = `${CONFIG_SHEET_NAME}!A1:B4`;
            try {
// FIX: Use window.gapi to access the Google API client, as `gapi` is not a global variable in the module scope.
                const response = await window.gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: gapiConfig.spreadsheetId,
                    range: range,
                });
                const values = response.result.values || [];
                const configMap: { [key: string]: string } = {};
                values.forEach((row: string[]) => { if (row[0]) configMap[row[0]] = row[1]; });
                setInitialBalances({ general: configMap['INITIAL_GENERAL_BALANCE'] || '0', provision: configMap['INITIAL_PROVISION_BALANCE'] || '0' });
                setMonthlyIncomeGoal(configMap['MONTHLY_INCOME_GOAL'] || '0');
                setLastRolloverMonth(configMap['LAST_ROLLOVER_MONTH'] || '');
            } catch (err) {
                console.error("Error loading config", err);
                // Don't throw, just use defaults
            }
        };

        const loadTransactionsForEffect = async () => {
            const range = `${TRANSACTIONS_SHEET_NAME}!A:G`;
            try {
// FIX: Use window.gapi to access the Google API client, as `gapi` is not a global variable in the module scope.
                const response = await window.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: gapiConfig.spreadsheetId, range: range });
                const values = response.result.values || [];
                const loadedTransactions = values.map((row: any[], index: number): Transaction => ({
                    id: row[0], date: row[1], description: row[2], amount: parseFloat(row[3]) || 0, type: row[4] as TransactionType,
                    source: row[5] as TransactionSource, destination: row[6] as TransactionSource | undefined, rowIndex: index + 1,
                })).filter(tx => tx.id);
                setTransactions(loadedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            } catch (err) {
                console.error("Error loading transactions", err);
                throw new Error("Failed to load transactions.");
            }
        };

        // Define the listener function here to ensure it uses the correct scope
        const statusUpdateListener = async (isUserSignedIn: boolean) => {
            setIsSignedIn(isUserSignedIn);
            if (isUserSignedIn) {
                setIsLoading(true);
                setError(null);
                try {
// FIX: Use window.gapi to access the Google API client, as `gapi` is not a global variable in the module scope.
                    const metaResponse = await window.gapi.client.sheets.spreadsheets.get({ spreadsheetId: gapiConfig.spreadsheetId });
                    const sheets: { [key:string]: number } = {};
                    metaResponse.result.sheets.forEach((s: any) => { sheets[s.properties.title] = s.properties.sheetId; });
                    setSheetIds(sheets);

                    await loadConfigForEffect();
                    await loadTransactionsForEffect();
                } catch (err: any) {
                    console.error("Error loading data from Google Sheets:", err);
                    setError(`Không thể tải dữ liệu. Lỗi: ${err.result?.error?.message || 'Unknown error'}. Vui lòng kiểm tra lại ID Bảng tính và quyền truy cập.`);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setTransactions([]);
                setInitialBalances({ general: '0', provision: '0' });
                setMonthlyIncomeGoal('0');
                setLastRolloverMonth('');
                setIsLoading(false);
            }
        };
        
        const initClient = async () => {
            try {
// FIX: Use window.gapi to access the Google API client, as `gapi` is not a global variable in the module scope.
                await window.gapi.client.init({
                    apiKey: gapiConfig.apiKey,
                    clientId: gapiConfig.clientId,
                    scope: SCOPES,
                    discoveryDocs: DISCOVERY_DOCS,
                });
// FIX: Use window.gapi to access the Google API client, as `gapi` is not a global variable in the module scope.
                const authInstance = window.gapi.auth2.getAuthInstance();
                authInstance.isSignedIn.listen(statusUpdateListener);
                await statusUpdateListener(authInstance.isSignedIn.get());
            } catch (err: any) {
                 let errorMessage = 'Lỗi không xác định';
                 if (err.details) { errorMessage = err.details; } 
                 else if (err.error) { errorMessage = `${err.error}: ${err.error_description || 'Đã có lỗi xảy ra'}`; }
                 else if (err.message) { errorMessage = err.message; }
                 setError(`Không thể khởi tạo Google API client. Lỗi: ${errorMessage}. Mẹo: Hãy kiểm tra lại API Key, Client ID và chắc chắn rằng domain của ứng dụng (URL trong thanh địa chỉ) đã được thêm vào "Authorized JavaScript origins" trong Google Cloud Console.`);
                 console.error("GAPI Init Error:", err);
                 setIsLoading(false);
            }
        };

        initClient();

    }, [gapiConfig, isGapiScriptLoaded]);


    const handleConnect = (config: { apiKey: string, clientId: string, spreadsheetId: string }) => {
        setIsLoading(true); // Show loader immediately while the effect runs
        setGapiConfig(config);
    };
    
    const handleSignIn = () => {
// FIX: Use window.gapi to access the Google API client, as `gapi` is not a global variable in the module scope.
        const authInstance = window.gapi.auth2.getAuthInstance();
        if (authInstance) {
            authInstance.signIn();
        } else {
            setError("Lỗi: Dịch vụ xác thực chưa sẵn sàng. Vui lòng thử lại.");
        }
    };

    const handleSignOut = () => {
// FIX: Use window.gapi to access the Google API client, as `gapi` is not a global variable in the module scope.
        const authInstance = window.gapi.auth2.getAuthInstance();
        if (authInstance) {
            authInstance.signOut();
        }
    };

    const handleAddTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!gapiConfig) return;
        
        const amount = parseFloat(newTxData.amount);
        if (!newTxData.description.trim() || isNaN(amount) || amount <= 0) {
            alert("Vui lòng điền đầy đủ và chính xác các thông tin.");
            return;
        }

        if (newTxData.type === TransactionType.TRANSFER && newTxData.source === newTxData.destination) {
            alert("Nguồn và đích không được giống nhau khi thực hiện chuyển khoản.");
            return;
        }
        
        const newTransaction: Omit<Transaction, 'rowIndex'> = {
            id: `txn-${new Date().getTime()}`,
            date: new Date(newTxData.date).toISOString(),
            description: newTxData.description.trim(),
            amount: amount,
            type: newTxData.type,
            source: newTxData.source,
            destination: newTxData.type === TransactionType.TRANSFER ? newTxData.destination : undefined,
        };
        
        setIsSaving(true);
        try {
             const values = [
                newTransaction.id,
                newTransaction.date,
                newTransaction.description,
                newTransaction.amount,
                newTransaction.type,
                newTransaction.source,
                newTransaction.destination || '',
            ];
// FIX: Use window.gapi to access the Google API client, as `gapi` is not a global variable in the module scope.
            await window.gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: gapiConfig.spreadsheetId,
                range: `${TRANSACTIONS_SHEET_NAME}!A:G`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [values] },
            });
            // Instead of reloading all, just add to state for better UX
            const updatedTransactions = [...transactions, { ...newTransaction, rowIndex: transactions.length + 2 }]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setTransactions(updatedTransactions);
            
            // Reset form
            setNewTxData({
                description: '',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                type: TransactionType.EXPENSE,
                source: TransactionSource.GENERAL,
                destination: TransactionSource.GENERAL,
            });
        } catch(err: any) {
             console.error("Error adding transaction:", err);
             setError(`Không thể thêm giao dịch. Lỗi: ${err.result?.error?.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTransaction = async (txIdToDelete: string) => {
        if (!window.confirm(`Bạn có chắc muốn xóa giao dịch này không?`) || !gapiConfig) return;

        const txToDelete = transactions.find(tx => tx.id === txIdToDelete);
        if (!txToDelete || txToDelete.rowIndex === undefined) {
             // Fallback: If rowIndex is missing, reload all data to find it.
            try {
                setIsLoading(true);
                const range = `${TRANSACTIONS_SHEET_NAME}!A:G`;
// FIX: Use window.gapi to access the Google API client, as `gapi` is not a global variable in the module scope.
                const response = await window.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: gapiConfig.spreadsheetId, range: range });
                const values = response.result.values || [];
                const foundTx = values.findIndex((row: any[]) => row[0] === txIdToDelete);
                if (foundTx !== -1) {
                    txToDelete.rowIndex = foundTx + 1;
                } else {
                    setError("Không tìm thấy giao dịch để xóa trên Google Sheet.");
                    setIsLoading(false);
                    return;
                }
            } catch(e) {
                 setError("Lỗi khi tìm giao dịch để xóa.");
                 setIsLoading(false);
                 return;
            } finally {
                setIsLoading(false);
            }
        }
        
        setIsSaving(true);
        try {
// FIX: Use window.gapi to access the Google API client, as `gapi` is not a global variable in the module scope.
            await window.gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: gapiConfig.spreadsheetId,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheetIds[TRANSACTIONS_SHEET_NAME],
                                dimension: 'ROWS',
                                startIndex: txToDelete.rowIndex - 1,
                                endIndex: txToDelete.rowIndex,
                            },
                        },
                    }],
                },
            });
            // Optimistic update
            setTransactions(prev => prev.filter(tx => tx.id !== txIdToDelete));

        } catch (err: any) {
            console.error("Error deleting transaction:", err);
            setError(`Không thể xóa giao dịch. Lỗi: ${err.result?.error?.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!gapiConfig) return;

        setIsSaving(true);
        try {
            const data = [
                { range: `${CONFIG_SHEET_NAME}!A1:B1`, values: [['INITIAL_GENERAL_BALANCE', initialBalances.general]] },
                { range: `${CONFIG_SHEET_NAME}!A2:B2`, values: [['INITIAL_PROVISION_BALANCE', initialBalances.provision]] },
                { range: `${CONFIG_SHEET_NAME}!A3:B3`, values: [['MONTHLY_INCOME_GOAL', monthlyIncomeGoal]] },
                { range: `${CONFIG_SHEET_NAME}!A4:B4`, values: [['LAST_ROLLOVER_MONTH', lastRolloverMonth]] },
            ];

// FIX: Use window.gapi to access the Google API client, as `gapi` is not a global variable in the module scope.
            await window.gapi.client.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: gapiConfig.spreadsheetId,
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: data,
                },
            });
            alert("Đã lưu cài đặt thành công!");
        } catch (err: any) {
            console.error("Error saving settings:", err);
            setError(`Không thể lưu cài đặt. Lỗi: ${err.result?.error?.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleNewTxChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewTxData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleInitialBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setInitialBalances(prev => ({ ...prev, [name]: value }));
    };

    const handleIncomeGoalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMonthlyIncomeGoal(e.target.value);
    };
    
    // Effect for handling the monthly rollover on the 15th
    useEffect(() => {
        if (!isSignedIn || !gapiConfig) return; // Don't run if not signed in

        const now = new Date(currentDate);
        const dayOfMonth = now.getDate();
        const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        
        if (dayOfMonth >= 15 && lastRolloverMonth !== currentMonthStr) {
            const prevPeriodStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
            const prevPeriodEndDate = new Date(now.getFullYear(), now.getMonth(), 15);

            const prevPeriodTransactions = transactions.filter(tx => {
                const txDate = new Date(tx.date);
                return txDate >= prevPeriodStartDate && txDate < prevPeriodEndDate;
            });

            const spent = prevPeriodTransactions
                .filter(tx => tx.type === TransactionType.EXPENSE)
                .reduce((sum, tx) => sum + tx.amount, 0);

            const transferOutFromGeneral = prevPeriodTransactions
                .filter(tx => tx.type === TransactionType.TRANSFER && tx.source === TransactionSource.GENERAL)
                .reduce((sum, tx) => sum + tx.amount, 0);
            
            const totalUsed = spent + transferOutFromGeneral;
            const goal = parseFloat(monthlyIncomeGoal) || 0;
            const rolloverAmount = goal - totalUsed;

            if (rolloverAmount > 0) {
                const newBalance = (parseFloat(initialBalances.general) || 0) + rolloverAmount;
                const updatedBalances = { ...initialBalances, general: newBalance.toString() };
                
                const data = [
                    { range: `${CONFIG_SHEET_NAME}!B1`, values: [[newBalance.toString()]] },
                    { range: `${CONFIG_SHEET_NAME}!B4`, values: [[currentMonthStr]] },
                ];

// FIX: Use window.gapi to access the Google API client, as `gapi` is not a global variable in the module scope.
                window.gapi.client.sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId: gapiConfig.spreadsheetId,
                    resource: { valueInputOption: 'USER_ENTERED', data },
                }).then(() => {
                    setInitialBalances(updatedBalances);
                    setLastRolloverMonth(currentMonthStr);
                    alert(`Đã quyết toán kỳ trước. Số dư còn lại ${formatCurrency(rolloverAmount)} đã được cộng vào số dư chính.`);
                }).catch((err: any) => {
                    setError(`Không thể cập nhật quyết toán tự động. Lỗi: ${err.result?.error?.message}`);
                });
            } else {
// FIX: Use window.gapi to access the Google API client, as `gapi` is not a global variable in the module scope.
                 window.gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: gapiConfig.spreadsheetId,
                    range: `${CONFIG_SHEET_NAME}!B4`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[currentMonthStr]] }
                }).then(() => {
                     setLastRolloverMonth(currentMonthStr);
                });
            }
        }
    }, [currentDate, transactions, monthlyIncomeGoal, initialBalances, lastRolloverMonth, gapiConfig, isSignedIn]);

    // --- Memoized calculations for UI ---
    const balances = useMemo(() => {
        const initialGeneral = parseFloat(initialBalances.general) || 0;
        const initialProvision = parseFloat(initialBalances.provision) || 0;

        let general = initialGeneral;
        let provision = initialProvision;

        transactions.forEach(tx => {
            switch (tx.type) {
                case TransactionType.INCOME:
                    if (tx.source === TransactionSource.GENERAL) general += tx.amount;
                    else if (tx.source === TransactionSource.PROVISION) provision += tx.amount;
                    break;
                case TransactionType.EXPENSE:
                    if (tx.source === TransactionSource.GENERAL) general -= tx.amount;
                    else if (tx.source === TransactionSource.PROVISION) provision -= tx.amount;
                    break;
                case TransactionType.TRANSFER:
                    if (tx.source === TransactionSource.GENERAL && tx.destination === TransactionSource.PROVISION) {
                        general -= tx.amount;
                        provision += tx.amount;
                    } else if (tx.source === TransactionSource.PROVISION && tx.destination === TransactionSource.GENERAL) {
                        provision -= tx.amount;
                        general += tx.amount;
                    }
                    break;
            }
        });

        return { general, provision };
    }, [transactions, initialBalances]);

    const currentMonthStats = useMemo(() => {
        const goal = parseFloat(monthlyIncomeGoal) || 0;
        const now = new Date(currentDate);
        const dayOfMonth = now.getDate();

        let startDate, endDate;

        if (dayOfMonth < 15) {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
            endDate = new Date(now.getFullYear(), now.getMonth(), 15);
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 15);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 15);
        }

        const periodTransactions = transactions.filter(tx => {
            const txDate = new Date(tx.date);
            return txDate >= startDate && txDate < endDate;
        });

        const spent = periodTransactions
            .filter(tx => tx.type === TransactionType.EXPENSE)
            .reduce((sum, tx) => sum + tx.amount, 0);

        const transferOutFromGeneral = periodTransactions
            .filter(tx => tx.type === TransactionType.TRANSFER && tx.source === TransactionSource.GENERAL)
            .reduce((sum, tx) => sum + tx.amount, 0);
            
        const totalUsed = spent + transferOutFromGeneral;

        const remaining = goal > 0 ? goal - totalUsed : 0;
        const progress = goal > 0 ? (totalUsed / goal) * 100 : 0;

        return { remaining, totalUsed, progress: Math.min(progress, 100) };
    }, [transactions, monthlyIncomeGoal, currentDate]);
    
    const uniqueMonths = useMemo(() => {
        const months = new Set(transactions.map(tx => tx.date.substring(0, 7)));
        return Array.from(months).sort().reverse();
    }, [transactions]);
    
    const [selectedMonth, setSelectedMonth] = useState<string>('');

    useEffect(() => {
        if (uniqueMonths.length > 0) {
            if (!selectedMonth || !uniqueMonths.includes(selectedMonth)) {
                setSelectedMonth(uniqueMonths[0]);
            }
        } else {
             setSelectedMonth('');
        }
    }, [uniqueMonths, selectedMonth]);

    const monthlyData = useMemo(() => processMonthlyData(transactions), [transactions]);
    const dailyData = useMemo(() => selectedMonth ? processDailyData(transactions, selectedMonth) : [], [transactions, selectedMonth]);

    const selectedMonthSummary = useMemo(() => {
        if (!selectedMonth) return { income: 0, expense: 0, transferOut: 0, remaining: 0 };

        const summary = { income: 0, expense: 0, transferOut: 0 };

        transactions
            .filter(tx => tx.date.startsWith(selectedMonth))
            .forEach(tx => {
                if (tx.type === TransactionType.INCOME) summary.income += tx.amount;
                else if (tx.type === TransactionType.EXPENSE) summary.expense += tx.amount;
                else if (tx.type === TransactionType.TRANSFER && tx.source === TransactionSource.GENERAL) summary.transferOut += tx.amount;
            });
        
        const remaining = summary.income - summary.expense - summary.transferOut;
        return { ...summary, remaining };
    }, [transactions, selectedMonth]);
    
    // --- Render logic ---
    if (!gapiConfig) {
        return <ConfigSetup onConnect={handleConnect} initialSpreadsheetId="1ZY4epEmhscFzkZEXcCUG5HyuxiQIxuiNJx5_RsgE984" isGapiReady={isGapiScriptLoaded} />;
    }
    
    if (isLoading) {
         return (
             <div className="absolute inset-0 bg-primary bg-opacity-75 flex items-center justify-center z-50">
                <div className="text-center">
                    <i className="fas fa-spinner fa-spin text-highlight text-4xl"></i>
                    <p className="mt-4 text-lg">Đang tải dữ liệu...</p>
                </div>
            </div>
        )
    }

    if (!isSignedIn) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-primary">
                <div className="bg-secondary p-8 rounded-lg shadow-lg text-center">
                    <h2 className="text-2xl font-bold text-highlight mb-4">Chào mừng bạn!</h2>
                    <p className="text-text-secondary mb-6">Vui lòng đăng nhập với tài khoản Google để tiếp tục.</p>
                    <button
                        onClick={handleSignIn}
                        className="bg-highlight text-primary font-bold py-2 px-6 rounded-md hover:bg-teal-400 transition duration-300 flex items-center justify-center mx-auto"
                    >
                       <i className="fab fa-google mr-2"></i> Đăng nhập với Google
                    </button>
                    {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-primary text-text-primary min-h-screen font-sans flex flex-col relative">
            {(isSaving) && (
                <div className="absolute inset-0 bg-primary bg-opacity-75 flex items-center justify-center z-50">
                    <div className="text-center">
                        <i className="fas fa-spinner fa-spin text-highlight text-4xl"></i>
                        <p className="mt-4 text-lg">Đang lưu...</p>
                    </div>
                </div>
            )}
            <header className="bg-secondary p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
                <h1 className="text-2xl font-bold text-highlight">
                    <i className="fas fa-wallet mr-2"></i>
                    Personal Finance Tracker
                </h1>
                <button
                    onClick={handleSignOut}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2 px-4 rounded-md transition duration-300"
                >
                    <i className="fas fa-sign-out-alt mr-2"></i>Đăng xuất
                </button>
            </header>
            
            {error && (
                 <div className="bg-red-500 text-white p-4 m-4 rounded-lg shadow-lg text-center">
                    <p>{error}</p>
                    <button onClick={() => setError(null)} className="font-bold underline ml-4">Đóng</button>
                </div>
            )}

            <main className="p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 flex-grow">
                <div className="lg:col-span-2 space-y-8">
                    <form className="bg-secondary p-6 rounded-lg shadow-lg" onSubmit={handleSaveSettings}>
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-text-secondary">Thiết lập số dư & Thu nhập</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="general" className="block text-sm font-medium text-text-secondary mb-1">Số dư chính</label>
                                <input type="number" name="general" id="general" value={initialBalances.general} onChange={handleInitialBalanceChange} placeholder="0" className="w-full bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight" />
                            </div>
                            <div>
                                <label htmlFor="provision" className="block text-sm font-medium text-text-secondary mb-1">Quỹ dự phòng</label>
                                <input type="number" name="provision" id="provision" value={initialBalances.provision} onChange={handleInitialBalanceChange} placeholder="0" className="w-full bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight" />
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label htmlFor="incomeGoal" className="block text-sm font-medium text-text-secondary mb-1">Thiết lập thu nhập hàng tháng</label>
                                <input type="number" name="incomeGoal" id="incomeGoal" value={monthlyIncomeGoal} onChange={handleIncomeGoalChange} placeholder="0" className="w-full bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight" />
                            </div>
                            <div>
                               <label htmlFor="currentDate" className="block text-sm font-medium text-text-secondary mb-1">Ngày hiện tại (để tính toán)</label>
                                <input type="date" name="currentDate" id="currentDate" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="w-full bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight" />
                            </div>
                        </div>
                        <button type="submit" className="mt-4 w-full bg-highlight text-primary font-bold py-2 px-4 rounded-md hover:bg-teal-400 transition duration-300">
                            Lưu Cài Đặt
                        </button>
                    </form>
                
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-secondary p-6 rounded-lg shadow-lg">
                            <h3 className="text-lg font-semibold text-text-secondary mb-2">Số dư chính</h3>
                            <p className="text-3xl font-bold text-green-400">{formatCurrency(balances.general)}</p>
                        </div>
                        <div className="bg-secondary p-6 rounded-lg shadow-lg">
                            <h3 className="text-lg font-semibold text-text-secondary mb-2">Số dư quỹ dự phòng</h3>
                            <p className="text-3xl font-bold text-yellow-400">{formatCurrency(balances.provision)}</p>
                        </div>
                         <div className="bg-secondary p-6 rounded-lg shadow-lg">
                            <h3 className="text-lg font-semibold text-text-secondary mb-2">Thu nhập còn lại (kỳ này)</h3>
                            <p className={`text-3xl font-bold ${currentMonthStats.remaining >= 0 ? 'text-blue-400' : 'text-red-500'}`}>
                                {formatCurrency(currentMonthStats.remaining)}
                            </p>
                             <div className="mt-4">
                                <div className="w-full bg-primary rounded-full h-2.5">
                                    <div className={`h-2.5 rounded-full ${currentMonthStats.progress > 85 ? 'bg-red-500' : currentMonthStats.progress > 60 ? 'bg-yellow-500' : 'bg-highlight'}`} style={{ width: `${currentMonthStats.progress}%` }} role="progressbar" ></div>
                                </div>
                                <div className="flex justify-between text-sm text-text-secondary mt-1">
                                    <span>Đã dùng: {formatCurrency(currentMonthStats.totalUsed)}</span>
                                    <span>Mục tiêu: {formatCurrency(parseFloat(monthlyIncomeGoal) || 0)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                     {selectedMonth && (
                        <div className="bg-secondary p-6 rounded-lg shadow-lg">
                            <h3 className="text-lg font-semibold text-text-secondary mb-4">Dòng tiền tháng {selectedMonth.substring(5, 7)}/{selectedMonth.substring(0, 4)}</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center"><p>Thu nhập:</p><p className="font-bold text-green-400">(+) {formatCurrency(selectedMonthSummary.income)}</p></div>
                                <div className="flex justify-between items-center"><p>Chi tiêu:</p><p className="font-bold text-red-400">(-) {formatCurrency(selectedMonthSummary.expense)}</p></div>
                                <div className="flex justify-between items-center"><p>Chuyển khoản đi (Nguồn chính):</p><p className="font-bold text-yellow-400">(-) {formatCurrency(selectedMonthSummary.transferOut)}</p></div>
                                <hr className="border-accent my-2" />
                                <div className="flex justify-between items-center">
                                    <p className="text-xl font-bold">Còn lại:</p>
                                    <p className={`text-2xl font-bold ${selectedMonthSummary.remaining >= 0 ? 'text-highlight' : 'text-red-500'}`}>{formatCurrency(selectedMonthSummary.remaining)}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <MonthlyComparisonChart data={monthlyData} />
                    
                    <div className="bg-secondary p-6 rounded-lg shadow-lg">
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Chi tiêu hàng ngày</h3>
                             <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-primary border border-accent rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-highlight" disabled={uniqueMonths.length === 0}>
                                {uniqueMonths.map(month => (<option key={month} value={month}>{month}</option>))}
                            </select>
                        </div>
                        <DailyExpenseChart data={dailyData} month={selectedMonth ? selectedMonth.substring(5, 7) : ''} />
                    </div>
                </div>

                <aside className="lg:col-span-1 bg-secondary p-6 rounded-lg shadow-lg">
                    <div className="mb-6">
                        <h3 className="text-xl font-bold mb-4">Thêm giao dịch mới</h3>
                        <form onSubmit={handleAddTransaction} className="space-y-3">
                            <input type="text" name="description" value={newTxData.description} onChange={handleNewTxChange} placeholder="Mô tả" className="w-full bg-primary border border-accent rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-highlight" required />
                            <input type="number" name="amount" value={newTxData.amount} onChange={handleNewTxChange} placeholder="Số tiền" className="w-full bg-primary border border-accent rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-highlight" required />
                            <input type="date" name="date" value={newTxData.date} onChange={handleNewTxChange} className="w-full bg-primary border border-accent rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-highlight" required />
                            <select name="type" value={newTxData.type} onChange={handleNewTxChange} className="w-full bg-primary border border-accent rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-highlight">
                                <option value={TransactionType.EXPENSE}>Chi tiêu</option>
                                <option value={TransactionType.INCOME}>Thu nhập</option>
                                <option value={TransactionType.TRANSFER}>Chuyển khoản</option>
                            </select>
                            <select name="source" value={newTxData.source} onChange={handleNewTxChange} className="w-full bg-primary border border-accent rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-highlight">
                                <option value={TransactionSource.GENERAL}>Nguồn chính</option>
                                <option value={TransactionSource.PROVISION}>Quỹ dự phòng</option>
                            </select>
                            {newTxData.type === TransactionType.TRANSFER && (
                                <select name="destination" value={newTxData.destination} onChange={handleNewTxChange} className="w-full bg-primary border border-accent rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-highlight">
                                    <option value={TransactionSource.GENERAL}>Nguồn chính</option>
                                    <option value={TransactionSource.PROVISION}>Quỹ dự phòng</option>
                                </select>
                            )}
                            <button type="submit" className="w-full bg-highlight text-primary font-bold py-2 px-4 rounded-md hover:bg-teal-400 transition duration-300">Thêm</button>
                        </form>
                    </div>

                    <h3 className="text-xl font-bold mb-4">Giao dịch gần đây</h3>
                    <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-450px)]">
                        {transactions.slice(0, 20).map(tx => (
                            <div key={tx.id} className="flex justify-between items-center p-3 bg-primary rounded-md group">
                                <div>
                                    <p className="font-semibold">{tx.description}</p>
                                    <p className="text-sm text-text-secondary">{new Date(tx.date).toLocaleDateString('vi-VN')}
                                        <span className="mx-2">·</span>
                                        <span className={`${tx.type === TransactionType.INCOME ? 'text-green-400' : tx.type === TransactionType.EXPENSE ? 'text-red-400' : 'text-yellow-400'}`}>
                                            {tx.type === TransactionType.INCOME ? 'Thu nhập' : tx.type === TransactionType.EXPENSE ? 'Chi tiêu' : 'Chuyển khoản'}
                                        </span>
                                    </p>
                                </div>
                                <p className={`font-bold mr-4 ${tx.type === TransactionType.INCOME ? 'text-green-400' : tx.type === TransactionType.EXPENSE ? 'text-red-400' : 'text-yellow-400'}`}>
                                    {tx.type === TransactionType.INCOME ? '+' : tx.type === TransactionType.EXPENSE ? '-' : ''}{formatCurrency(tx.amount)}
                                </p>
                                <button onClick={() => handleDeleteTransaction(tx.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-trash"></i></button>
                            </div>
                        ))}
                         {transactions.length === 0 && !isLoading && (
                            <p className="text-text-secondary text-center mt-8">Không có giao dịch nào.</p>
                        )}
                    </div>
                </aside>
            </main>
            <footer className="bg-secondary text-center p-4 mt-auto">
                <p className="text-text-secondary text-sm">Developed by <a href="https://hoangtr.com.vn" target="_blank" rel="noopener noreferrer" className="text-highlight hover:underline">Hoang Tran</a>.</p>
                <p className="text-text-secondary text-sm mt-1">Support: <a href="mailto:huytrannguyen962@gmail.com" className="text-highlight hover:underline">huytrannguyen962@gmail.com</a></p>
            </footer>
        </div>
    );
};

export default App;