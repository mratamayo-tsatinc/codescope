/*
@codescope
@title Count up with for
@seed limit min=3 max=5
*/
public class CountUp {
    public static void main(String[] args) {
        int i;
        int limit = 4;

        System.out.println("FOR LOOP COUNT UP\n");

        for (i = 1; i <= limit; i++) {
            System.out.println(i);
        }

        System.out.println("\nCOUNTING COMPLETE: " + i);
    }
}

