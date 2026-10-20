/*
@codescope
@title Counter and product accumulator
@seed limit min=3 max=5
*/
public class ProductSequence {
    public static void main(String[] args) {
        int i = 1;
        int limit = 4;
        int product = 1;

        while (i <= limit) {
            System.out.println("multiply next factor");
            product *= i;
            i++;
            System.out.println("product now updated");
        }

        System.out.println("product " + product);
    }
}

