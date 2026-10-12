/*
 * @codescope
 * @title Circle Area Calculator
 * @bug id=bug-1 line=5 token=1 correct="double" wrong="Double" choices="Double|floaty"
 * @bug id=bug-2 line=6 token=1 correct="final" wrong="constant" choices="constant|const"
 * @bug id=bug-3 line=6 token=6 correct=";" wrong=":" choices=":|,"
 * @bug id=bug-4 line=8 token=5 correct="printf" wrong="Printf" choices="Printf|print"
 */
class CircleAreaCalculator
{
    public static void main(String[] args)
    {
        double radius = 5.0;
        final double PI = 3.14159;
        double area = PI * radius * radius;
        System.out.printf("The area is: %.2f%n", area);
    }
}
