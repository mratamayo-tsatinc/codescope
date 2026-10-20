/*
@codescope
@title Produce a final loop summary
@seed limit min=3 max=5
@seed amount min=1 max=3
*/
public class SummaryReport {
    public static void main(String[] args) {
        int i;
        int limit = 4;
        int amount = 2;
        int total = 0;

        for (i = 1; i <= limit; i++) {
            System.out.println("apply report amount");
            total += amount;
            System.out.println("step " + i + " total " + total);
            System.out.println("report row ready");
        }

        System.out.println("steps " + limit + " final " + total);
    }
}

