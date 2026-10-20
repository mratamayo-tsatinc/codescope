/*
@codescope
@title Increment a for loop by two
@seed limit min=6 max=10
*/
public class StepByTwo {
    public static void main(String[] args) {
        int i;
        int limit = 8;

        System.out.println("ADVANCE BY TWO\n");

        for (i = 0; i < limit; i += 2) {
            System.out.println(i);
            System.out.println("-");
        }

        System.out.println("FINAL VALUE: " + i);
    }
}

