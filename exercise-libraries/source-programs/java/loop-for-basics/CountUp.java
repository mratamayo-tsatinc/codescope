/*
@codescope
@title Count up with for
@seed limit min=3 max=5
*/
public class CountUp {
    public static void main(String[] args) {
        int i;
        int limit = 4;

        for (i = 1; i <= limit; i++) {
            System.out.println(i);
        }

        System.out.println("done " + i);
    }
}

