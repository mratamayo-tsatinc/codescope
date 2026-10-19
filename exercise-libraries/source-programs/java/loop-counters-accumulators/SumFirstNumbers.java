/*
@codescope
@title Counter and sum accumulator
@seed limit min=3 max=5
*/
public class SumFirstNumbers {
    public static void main(String[] args) {
        int i = 1;
        int limit = 4;
        int total = 0;

        while (i <= limit) {
            total += i;
            i++;
        }

        System.out.println("count " + i + " total " + total);
    }
}

