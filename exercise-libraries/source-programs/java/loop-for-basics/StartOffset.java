/*
@codescope
@title Start a for loop above zero
@seed start min=2 max=3
@seed limit min=5 max=7
*/
public class StartOffset {
    public static void main(String[] args) {
        int i;
        int start = 3;
        int limit = 6;

        System.out.println("START AT " + start + "\n");

        for (i = start; i < limit; i++) {
            System.out.println(i);
        }

        System.out.println("FINAL VALUE: " + i);
    }
}

