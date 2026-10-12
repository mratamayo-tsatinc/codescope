/*
 * @codescope
 * @title Product Discount Calculator
 * @bug id=bug-1 line=5 token=1 correct="double" wrong="Double" choices="Double|floaty"
 * @bug id=bug-2 line=6 token=4 correct="price" wrong="Price" choices="Price|cost"
 * @bug id=bug-3 line=7 token=4 correct="price" wrong="Price" choices="Price|cost"
 * @bug id=bug-4 line=8 token=5 correct="printf" wrong="Printf" choices="Printf|print"
 */
class ProductDiscountCalculator
{
    public static void main(String[] args)
    {
        double price = 100.0;
        double discount = price * 0.10;
        double total = price - discount;
        System.out.printf("Final Price: %.2f%n", total);
    }
}
