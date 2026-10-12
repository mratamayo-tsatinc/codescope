/*
 * @codescope
 * @title Wage Calculator
 * @bug id=bug-1 line=5 token=4 correct="40" wrong="\"40\"" choices="\"40\"|40.0"
 * @bug id=bug-2 line=6 token=4 correct="15.50" wrong="\"15.50\"" choices="\"15.50\"|15,50"
 * @bug id=bug-3 line=7 token=3 correct="=" wrong="==" choices="==|+="
 */
class WageCalculator
{
    public static void main(String[] args)
    {
        int hours = 40;
        double rate = 15.50;
        double total = hours * rate;
        System.out.printf("Pay: $%.2f", total);
    }
}
