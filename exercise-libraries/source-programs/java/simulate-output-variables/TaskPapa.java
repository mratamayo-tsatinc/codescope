/*
@codescope
@title Unary updates
@seed a min=2 max=12
@seed b min=2 max=12
@seed c min=5 max=15
@seed d min=5 max=15
@seed p min=2 max=9
@seed q min=2 max=9
*/
public class TaskPapa {
    public static void main(String[] args) {
        int a = 5;
        int b = 5;
        int c = 10;
        int d = 10;

        System.out.println("Initial value of a: " + a);
        System.out.println("Initial value of b: " + b);
        System.out.println("Initial value of c: " + c);
        System.out.println("Initial value of d: " + d);
        System.out.println("");

        a--;
        ++b;
        c++;
        --d;

        System.out.println("Updated value of a: " + a);
        System.out.println("Updated value of b: " + b);
        System.out.println("Updated value of c: " + c);
        System.out.println("Updated value of d: " + d);
        System.out.println("");

        int p = 4;
        int q = 4;
        int sum = ++p + q++;

        System.out.println("sum = ++p + q++ : " + sum);
        System.out.println("final p: " + p);
        System.out.println("final q: " + q);
    }
}
