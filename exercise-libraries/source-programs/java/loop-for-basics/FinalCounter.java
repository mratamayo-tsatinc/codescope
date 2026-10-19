/*
@codescope
@title Observe a for counter after exit
@seed limit min=2 max=5
*/
public class FinalCounter {
    public static void main(String[] args) {
        int i;
        int limit = 3;

        for (i = 0; i < limit; i++) {
            System.out.println("loop " + i);
        }

        System.out.println("after " + i);
    }
}

