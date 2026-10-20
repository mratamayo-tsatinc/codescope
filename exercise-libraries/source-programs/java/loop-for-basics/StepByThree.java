/*
@codescope
@title Increment a for loop by three
@seed limit min=7 max=10
*/
public class StepByThree {
    public static void main(String[] args) {
        int i;
        int limit = 9;

        for (i = 0; i < limit; i += 3) {
            System.out.println(i);
        }

        System.out.println("FINAL VALUE: " + i);
    }
}

