/*
@codescope
@title Observe the final counter
@seed limit min=2 max=4
*/
public class FinalCounter {
    public static void main(String[] args) {
        int count = 1;
        int limit = 3;

        do {
            count++;
            System.out.println(count);
        } while (count <= limit);

        System.out.println("FINAL COUNT: " + count);
    }
}

