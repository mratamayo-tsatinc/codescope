/*
@codescope
@title Update two values in the body
@seed limit min=3 max=5
*/
public class CounterAndTotal {
    public static void main(String[] args) {
        int count = 0;
        int limit = 4;
        int total = 0;

        while (count < limit) {
            System.out.println("advance the counter");
            count++;
            total += count;
            System.out.println(count + " " + total);
            System.out.println("counter added to total");
        }

        System.out.println("final " + total);
    }
}

