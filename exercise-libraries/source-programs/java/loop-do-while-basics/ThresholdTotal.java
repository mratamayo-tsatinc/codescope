/*
@codescope
@title Accumulate to a threshold
@seed amount min=1 max=3
@seed limit min=5 max=8
*/
public class ThresholdTotal {
    public static void main(String[] args) {
        int amount = 2;
        int total = 0;
        int limit = 6;

        do {
            total += amount;
            System.out.println(total);
        } while (total < limit);

        System.out.println("final " + total);
    }
}

