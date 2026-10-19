/*
@codescope
@title Sum values with for
@seed limit min=3 max=5
*/
public class RunningTotal {
    public static void main(String[] args) {
        int i;
        int limit = 4;
        int total = 0;

        for (i = 1; i <= limit; i++) {
            total += i;
        }

        System.out.println("total " + total);
    }
}

