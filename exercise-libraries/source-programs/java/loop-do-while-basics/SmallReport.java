/*
@codescope
@title Build a short do while report
@seed limit min=2 max=4
*/
public class SmallReport {
    public static void main(String[] args) {
        int day = 1;
        int limit = 3;
        int points = 0;

        do {
            points += 2;
            System.out.println("day " + day + " points " + points);
            day++;
        } while (day <= limit);

        System.out.println("total " + points);
    }
}

