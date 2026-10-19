/*
@codescope
@title A while loop that may not run
@seed value min=4 max=6
@seed limit min=2 max=3
*/
public class ZeroIterations {
    public static void main(String[] args) {
        int value = 5;
        int limit = 3;

        while (value < limit) {
            value++;
        }

        System.out.println("value " + value);
    }
}

