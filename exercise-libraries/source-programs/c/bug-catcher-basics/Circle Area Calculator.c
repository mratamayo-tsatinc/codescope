/*
 * @codescope
 * @title Circle Area Calculator
 * @bug id=bug-1 line=5 token=1 correct="float" wrong="Float" choices="Float|doublee"
 * @bug id=bug-2 line=6 token=2 correct="double" wrong="int" choices="int|integer"
 * @bug id=bug-3 line=6 token=6 correct=";" wrong="." choices=".|:"
 * @bug id=bug-4 line=7 token=1 correct="printf" wrong="print" choices="print|Printf"
 * @bug id=bug-5 line=8 token=1 correct="scanf" wrong="Scanf" choices="Scanf|scan"
 * @bug id=bug-6 line=9 token=8 correct=";" wrong="?" choices="?|:"
 * @bug id=bug-7 line=11 token=3 correct=";" wrong=":" choices=":|,"
 */
#include <stdio.h>

int main()
{
    float radius, area;
    const double PI = 3.14159;
    printf("Enter radius: ");
    scanf("%f", &radius);
    area = PI * radius * radius;
    printf("The area is: %.2f\n", area);
    return 0;
}
