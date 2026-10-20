/*
@codescope
@title Watch an accumulator grow
@seed limit min=3 max=5
@seed amount min=1 max=3
*/
public class AccumulatorWalkthrough {
    public static void main(String[] args) {
        int count = 0;
        int limit = 4;
        int amount = 2;
        int total = 0;

        System.out.println("ACCUMULATOR WALKTHROUGH\n");

        while (count < limit) {
            System.out.println("add one amount");
            total += amount;
            count++;
            System.out.println("running total updated");
        }

        System.out.println("ACCUMULATION COMPLETE");
        System.out.println("total " + total);
    }
}
