/*
 * @codescope
 * @title Student Grade Averager
 * @bug id=bug-1 line=3 token=4 correct="main" wrong="Main" choices="Main|man"
 * @bug id=bug-2 line=5 token=1 correct="double" wrong="Double" choices="Double|floaty"
 * @bug id=bug-3 line=6 token=13 correct=";" wrong=":" choices=":|,"
 * @bug id=bug-4 line=7 token=5 correct="printf" wrong="Printf" choices="Printf|print"
 */
class StudentGradeAverager
{
    public static void main(String[] args)
    {
        double m1 = 88, m2 = 91, m3 = 85;
        double average = (m1 + m2 + m3) / 3.0;
        System.out.printf("Average is: %.2f%n", average);
    }
}
