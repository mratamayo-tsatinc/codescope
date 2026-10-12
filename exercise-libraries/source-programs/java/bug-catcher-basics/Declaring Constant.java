/*
 * @codescope
 * @title Declaring Constant
 * @bug id=bug-1 line=5 token=1 correct="final" wrong="constant" choices="constant|const"
 * @bug id=bug-2 line=5 token=6 correct=";" wrong=":" choices=":|,"
 */
class DeclaringConstant
{
    public static void main(String[] args)
    {
        final double PI = 3.14159;
        double radius = 5.0;
        double area = PI * radius * radius;
    }
}
