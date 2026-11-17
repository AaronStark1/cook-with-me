import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'search'
})
export class SearchPipe implements PipeTransform {

  transform(recipes: any[], searchKey: string): any {
    let result: any = [];
    if (!recipes || searchKey == '') {
      return recipes
    } else {
      result = recipes.filter((item: any) => item.name.toLowerCase().trim().includes(searchKey.toLocaleLowerCase().trim()))
      return result
    }
  }

}
