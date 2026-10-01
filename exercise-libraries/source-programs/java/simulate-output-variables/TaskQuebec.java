/*
@codescope
@title Compound assignments
@seed total min=10 max=30
@seed balance min=80.00 max=150.00 decimals=2
*/
public class TaskQuebec {
    public static void main(String[] args) {
        int total = 20;
        System.out.println("initial total: " + total);

        total += 15;
        System.out.print(total + "->");

        total -= 8;
        System.out.print(total + "->");

        total *= 3;
        System.out.print(total + "->");

        total /= 4;
        System.out.print(total + "->");

        total %= 5;
        System.out.println(total + "\n");

        double balance = 100.25;
        System.out.println("initial balance: " + balance);

        balance += 50.5;
        balance -= 20.25;
        balance *= 2;
        balance /= 4;

        System.out.println("final balance: " + balance);
    }
}
