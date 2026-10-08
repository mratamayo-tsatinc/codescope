/*
@codescope
@title Bank Account
@seed balance min=1100 max=1500 step=100
@seed deposit min=250 max=350 step=50
@seed withdrawal min=100 max=500 step=100
@seed serviceFee min=15 max=30 step=5
*/
public class TaskBravo
{
    public static void main(String[] args)
    {
        int balance = 1200, deposit = 350, withdrawal = 200, serviceFee = 25;
        int finalBalance;
        boolean transactionOK;

        finalBalance = balance + deposit - withdrawal - serviceFee;
        transactionOK = (deposit > 0 && withdrawal <= balance) || (withdrawal == 0 && !((deposit < 0)));

        if (transactionOK && finalBalance >= 1000) {
            serviceFee = serviceFee - 10;
        } else if (!transactionOK || finalBalance < 500) {
            serviceFee = serviceFee + 20;
        }

        finalBalance = balance + deposit - withdrawal - serviceFee;

        System.out.println("=== ACCOUNT STATEMENT ===");
        System.out.println("Previous Balance : " + balance);
        System.out.println("Deposit          : +" + deposit);
        System.out.println("Withdrawal       : -" + withdrawal);
        System.out.println("Service Fee      : -" + serviceFee);
        System.out.println("Current Balance  : " + finalBalance);
        
        if (transactionOK) {
            System.out.println("Transaction successful.");
        } else {
            System.out.println("Transaction failed.");
        }
    }
}
