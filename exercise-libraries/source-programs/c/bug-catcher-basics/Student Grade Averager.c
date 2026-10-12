/*
 * @codescope
 * @title Student Grade Averager
 * @bug id=bug-1 line=3 token=2 correct="main" wrong="Main" choices="Main|man"
 * @bug id=bug-2 line=6 token=1 correct="printf" wrong="print" choices="print|Printf"
 * @bug id=bug-3 line=7 token=14 correct=";" wrong=":" choices=":|,"
 * @bug id=bug-4 line=8 token=12 correct=";" wrong=":" choices=":|,"
 * @bug id=bug-5 line=9 token=7 correct=";" wrong=":" choices=":|,"
 * @bug id=bug-6 line=10 token=2 correct="0" wrong="\"0\"" choices="\"0\"|O"
 */
#include <stdio.h>

int main()
{
    float m1, m2, m3, average;
    printf("Enter three marks: ");
    scanf("%f %f %f", &m1, &m2, &m3);
    average = (m1 + m2 + m3) / 3.0;
    printf("Average is: %f", average);
    return 0;
}
