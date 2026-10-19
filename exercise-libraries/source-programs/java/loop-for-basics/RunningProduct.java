/*
@codescope
@title Multiply values with for
@seed limit min=3 max=5
*/
public class RunningProduct {
    public static void main(String[] args) {
        int i;
        int limit = 4;
        int product = 1;

        for (i = 1; i <= limit; i++) {
            product *= i;
        }

        System.out.println("product " + product);
    }
}

