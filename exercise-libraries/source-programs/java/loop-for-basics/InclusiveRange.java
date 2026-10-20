/*
@codescope
@title Use an inclusive for condition
@seed start min=1 max=2
@seed limit min=4 max=6
*/
public class InclusiveRange {
    public static void main(String[] args) {
        int i;
        int start = 2;
        int limit = 5;

        for (i = start; i <= limit; i++) {
            System.out.println(i);
        }

        System.out.println("FINAL VALUE: " + i);
    }
}

