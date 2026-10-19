/*
@codescope
@title Count up with while
@seed i min=1 max=2
@seed limit min=3 max=5
*/
public class CountUp {
    public static void main(String[] args) {
        int i = 1;
        int limit = 4;

        while (i <= limit) {
            System.out.println(i);
            i++;
        }

        System.out.println("done " + i);
    }
}

