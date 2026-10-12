/*
 * @codescope
 * @title C to F
 * @bug id=bug-1 line=5 token=1 correct="double" wrong="Double" choices="Double|floaty"
 * @bug id=bug-2 line=6 token=5 correct="celsius" wrong="Celsius" choices="Celsius|celcius"
 * @bug id=bug-3 line=7 token=5 correct="printf" wrong="Printf" choices="Printf|print"
 */
class CtoF
{
    public static void main(String[] args)
    {
        double celsius = 25.0;
        double fahrenheit = (celsius * 9 / 5) + 32;
        System.out.printf("Fahrenheit: %.1f%n", fahrenheit);
    }
}
