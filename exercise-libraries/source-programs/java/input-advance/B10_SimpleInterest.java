/*
@codescope
@title Simple Interest
@result totalAmount
@input target=principal value=10000.0 min=1000.0 max=100000.0 step=1000.0 decimals=2
@input target=rate value=5.5 min=1.0 max=20.0 step=0.5 decimals=1
@input target=years value=3 min=1 max=30 step=1
*/
import java.util.Scanner;

public class B10_SimpleInterest {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        final int PERCENT = 100;
        double principal;
        double rate;
        int years;
        double interest;
        double totalAmount;

        System.out.print("Enter the principal amount: ");
        principal = input.nextDouble();
        System.out.print("Enter the yearly rate and number of years: ");
        rate = input.nextDouble();
        years = input.nextInt();
        interest = principal * rate * years / PERCENT;
        totalAmount = principal + interest;
        System.out.println("Interest: " + interest);
        System.out.println("Total amount: " + totalAmount);
    }
}
