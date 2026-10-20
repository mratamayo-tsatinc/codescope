/*
@codescope
@title Add values with do while
@seed limit min=3 max=5
*/
public class RunningTotal {
    public static void main(String[] args) {
        int i = 1;
        int limit = 4;
        int total = 0;

        System.out.println("RUNNING TOTALS\n");

        do {
            total += i;
            System.out.println(total);
            i++;
        } while (i <= limit);

        System.out.println("\nFINAL TOTAL: " + total);
    }
}

