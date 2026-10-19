/*
@codescope
@title Accumulate squared counter values
@seed limit min=2 max=4
*/
public class SquareSum {
    public static void main(String[] args) {
        int i;
        int limit = 3;
        int total = 0;

        for (i = 1; i <= limit; i++) {
            total += i * i;
        }

        System.out.println("total " + total);
    }
}

