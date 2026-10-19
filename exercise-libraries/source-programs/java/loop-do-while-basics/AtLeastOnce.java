/*
@codescope
@title Do while runs at least once
@seed value min=4 max=6
@seed limit min=2 max=3
*/
public class AtLeastOnce {
    public static void main(String[] args) {
        int value = 5;
        int limit = 3;

        do {
            System.out.println(value);
            value++;
        } while (value < limit);

        System.out.println("final " + value);
    }
}

