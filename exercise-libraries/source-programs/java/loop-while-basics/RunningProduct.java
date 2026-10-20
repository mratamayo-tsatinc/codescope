/*
@codescope
@title Multiply values in a while loop
@seed limit min=3 max=5
*/
public class RunningProduct {
    public static void main(String[] args) {
        int factor = 1;
        int limit = 4;
        int product = 1;

        while (factor <= limit) {
            System.out.println("multiply next factor");
            product *= factor;
            factor++;
            System.out.println("factor advanced");
        }

        System.out.println("product " + product);
    }
}

