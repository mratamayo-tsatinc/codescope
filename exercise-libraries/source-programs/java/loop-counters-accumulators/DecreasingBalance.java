/*
@codescope
@title Track a changing balance
@seed limit min=2 max=4
@seed balance min=14 max=18
*/
public class DecreasingBalance {
    public static void main(String[] args) {
        int step = 1;
        int limit = 3;
        int balance = 15;

        do {
            System.out.println("subtract current step");
            balance -= step;
            step++;
            System.out.println("prepare larger step");
        } while (step <= limit);

        System.out.println("balance " + balance);
    }
}

