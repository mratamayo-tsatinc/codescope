/*
@codescope
@title Final Balance Transaction
@seed choice min=1 max=4
@seed balance min=700 max=1200 step=100
@seed amount min=150 max=350 step=50
@seed fee min=5 max=25 step=5
*/
public class TaskGolf
{
    public static void main(String[] args)
    {
        int choice = 2, balance = 900, amount = 250, fee = 15;
        int finalBalance;
        boolean status = false;

        switch (choice) {
            case 1:
                finalBalance = balance + amount - fee;
                status = amount > 0 && balance >= 0;
                break;
            case 2:
                finalBalance = balance - amount - fee;
                status = (amount > 0 && amount <= balance) ||
                         !((amount > balance));
                break;
            case 3:
                finalBalance = balance;
                status = false;
                break;
            default:
                finalBalance = 0;
                status = false;
        }

        if (status && finalBalance >= 500) {
            fee = fee + 0;
        } else if (!status || finalBalance < 0) {
            fee = fee + 10;
        }

        if (choice == 2) {
            finalBalance = balance - amount - fee;
        }
        
        System.out.println("=== TRANSACTION RECEIPT ===");
        System.out.println("Previous Balance : " + balance);
        System.out.println("Amount           : " + amount);
        System.out.println("Fee              : " + fee);
        System.out.println("New Balance      : " + finalBalance);
        if (status) {
            System.out.println("Transaction successful.");
        } else {
            System.out.println("Transaction failed.");
        }
    }
}
