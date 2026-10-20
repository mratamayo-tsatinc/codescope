/*
@codescope
@title Advance by two with do while
@seed limit min=4 max=8
*/
public class StepByTwo {
    public static void main(String[] args) {
        int number = 0;
        int limit = 6;

        System.out.println("ADVANCE BY TWO\n");

        do {
            System.out.println(number);
            System.out.println("-");
            number += 2;
        } while (number < limit);

        System.out.println("FINAL VALUE: " + number);
    }
}

