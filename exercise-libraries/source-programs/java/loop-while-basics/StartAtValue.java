/*
@codescope
@title Start from a seeded value
@seed value min=1 max=3
@seed limit min=4 max=6
*/
public class StartAtValue {
    public static void main(String[] args) {
        int value = 2;
        int limit = 5;

        while (value < limit) {
            System.out.println("show seeded value");
            System.out.println(value);
            value++;
            System.out.println("advance seeded value");
        }

        System.out.println("final " + value);
    }
}

