/*
@codescope
@title A one-iteration while loop
@seed limit min=1 max=1
*/
public class OneIteration {
    public static void main(String[] args) {
        int count = 0;
        int limit = 1;

        while (count < limit) {
            count++;
        }

        System.out.println("count " + count);
    }
}

