/*
@codescope
@title Count up with do while
@seed limit min=3 max=5
*/
public class CountUp {
    public static void main(String[] args) {
        int i = 1;
        int limit = 4;

        System.out.println("DO-WHILE COUNT UP\n");

        do {
            System.out.println(i);
            i++;
        } while (i <= limit);

        System.out.println("\nCOUNTING COMPLETE: " + i);
    }
}

